import prisma from "../config/db.js";

// =================================================================
// ১. ইনভয়েস খোঁজা (Find Sale Invoice for Return)
// =================================================================
export const findSaleForReturn = async (req, res) => {
  try {
    const { query, shopId } = req.query;

    if (!query || !shopId) {
      return res.status(400).json({ success: false, message: "Query এবং Shop ID প্রয়োজন।" });
    }

    const sale = await prisma.sale.findFirst({
      where: {
        shopId: Number(shopId),
        OR: [
          { invoiceNo: query.trim() },
          { customer: { phone: query.trim() } }
        ]
      },
      include: {
        customer: true,
        saleItems: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: "কোনো বিক্রয় ইনভয়েস পাওয়া যায়নি।" });
    }

    return res.status(200).json({ success: true, data: sale });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ২. কাস্টমার রিটার্ন তৈরি (Create Customer Return) — অপরিবর্তিত
// =================================================================
export const createCustomerReturn = async (req, res) => {
  try {
    const {
      shopId,
      saleId,
      customerId,
      accountId,
      items,
      restockingFee = 0,
      refundMethod,
      reason,
      notes
    } = req.body;

    const receivedById = req.user?.id || req.body.receivedById;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "কমপক্ষে একটি পণ্য নির্বাচন করুন।" });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: Number(saleId) }
        });

        if (!sale) {
          throw new Error("মূল বিক্রয় ইনভয়েস পাওয়া যায়নি।");
        }

        const totalAmount = items.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
          0
        );
        const refundAmount = Math.max(0, totalAmount - Number(restockingFee));
        const returnInvoiceNo = `RET-${Date.now().toString().slice(-6)}`;

        const customerReturn = await tx.customerReturn.create({
          data: {
            returnInvoiceNo,
            shopId: Number(shopId),
            saleId: Number(saleId),
            customerId: customerId ? Number(customerId) : sale.customerId,
            receivedById: Number(receivedById),
            totalAmount,
            restockingFee: Number(restockingFee),
            refundAmount,
            refundMethod,
            reason,
            notes,
            items: {
              create: items.map((item) => ({
                productId: Number(item.productId),
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                totalPrice: Number(item.quantity) * Number(item.unitPrice),
                condition: item.condition
              }))
            }
          },
          include: { items: true }
        });

        for (const item of items) {
          const prodId = Number(item.productId);
          const qty = Number(item.quantity);

          const product = await tx.product.findUnique({
            where: { id: prodId },
            select: { id: true, quantity: true, damagedQuantity: true, purchasePrice: true }
          });

          if (!product) throw new Error(`প্রোডাক্ট পাওয়া যায়নি: ID ${prodId}`);

          if (item.condition === "GOOD") {
            const updatedProduct = await tx.product.update({
              where: { id: prodId },
              data: { quantity: { increment: qty } }
            });

            // 👇 এই sale-এ এই প্রোডাক্টটা আসলে কোন কোন layer/দাম থেকে কাটা হয়েছিল সেটা বের করা
            const saleItem = await tx.saleItem.findFirst({
              where: { saleId: Number(saleId), productId: prodId },
              include: {
                layerDeductions: { orderBy: { id: "desc" } } // শেষে কাটা layer আগে ফেরত (LIFO)
              }
            });

            let remainingToRestock = qty;

            if (saleItem && saleItem.layerDeductions.length > 0) {
              for (const deduction of saleItem.layerDeductions) {
                if (remainingToRestock <= 0) break;

                const availableToRestore = deduction.quantityTaken - deduction.returnedQty;
                if (availableToRestore <= 0) continue;

                const restoreQty = Math.min(remainingToRestock, availableToRestore);

                // ওই একই original layer-এ, ওই একই unitCost-এ ফেরত যাচ্ছে
                await tx.inventoryLayer.update({
                  where: { id: deduction.inventoryLayerId },
                  data: { remainingQty: { increment: restoreQty } }
                });

                await tx.saleItemLayer.update({
                  where: { id: deduction.id },
                  data: { returnedQty: { increment: restoreQty } }
                });

                remainingToRestock -= restoreQty;
              }
            }

            // sale layer history না পাওয়া গেলে বা mismatch থাকলে fallback হিসেবে বর্তমান দামে নতুন layer
            if (remainingToRestock > 0) {
              await tx.inventoryLayer.create({
                data: {
                  shopId: Number(shopId),
                  productId: prodId,
                  initialQty: remainingToRestock,
                  remainingQty: remainingToRestock,
                  unitCost: product.purchasePrice
                }
              });
            }

            await tx.stockLog.create({
              data: {
                productId: prodId,
                userId: Number(receivedById),
                changeType: "RETURN_INWARD",
                quantityChanged: qty,
                previousStock: product.quantity,
                newStock: updatedProduct.quantity,
                note: `Customer Return #${returnInvoiceNo} (Good Condition)`
              }
            });
          } else {
            const updatedProduct = await tx.product.update({
              where: { id: prodId },
              data: { damagedQuantity: { increment: qty } }
            });

            await tx.stockLog.create({
              data: {
                productId: prodId,
                userId: Number(receivedById),
                changeType: "DAMAGE",
                quantityChanged: qty,
                previousStock: product.damagedQuantity,
                newStock: updatedProduct.damagedQuantity,
                note: `Customer Return Defective #${returnInvoiceNo}`
              }
            });
          }
        }

        if (refundMethod === "ADJUST_DUE" && sale.dueAmount > 0) {
          const newDue = Math.max(0, sale.dueAmount - refundAmount);
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              dueAmount: newDue,
              paymentStatus: newDue === 0 ? "PAID" : "PARTIAL"
            }
          });
        }

        // ক্যাশ রিফান্ড হলে নির্দিষ্ট অ্যাকাউন্ট থেকে টাকা মাইনাস এবং ট্রানজাকশন লেজার এন্ট্রি তৈরি
        if (refundMethod === "CASH" && refundAmount > 0) {
          let targetAccountId = accountId ? Number(accountId) : null;

          if (!targetAccountId) {
            const defaultAccount = await tx.account.findFirst({
              where: { shopId: Number(shopId), type: 'CASH', isDefault: true }
            }) || await tx.account.findFirst({
              where: { shopId: Number(shopId) }
            });

            if (defaultAccount) {
              targetAccountId = defaultAccount.id;
            }
          }

          if (targetAccountId) {
            await tx.account.update({
              where: { id: targetAccountId },
              data: { balance: { decrement: refundAmount } }
            });

            await tx.transaction.create({
              data: {
                shopId: Number(shopId),
                accountId: targetAccountId,
                type: 'OUT',
                amount: refundAmount,
                category: 'CUSTOMER_RETURN',
                referenceId: customerReturn.id,
                note: `Refund for Customer Return Invoice: ${returnInvoiceNo}`,
                date: new Date().toISOString().split('T')[0],
                createdById: Number(receivedById),
              }
            });
          }
        }

        return customerReturn;
      },
      {
        maxWait: 5000,
        timeout: 20000
      }
    );

    return res.status(201).json({
      success: true,
      message: "কাস্টমার রিটার্ন সফলভাবে সম্পন্ন হয়েছে।",
      data: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৩. সাপ্লায়ার রিটার্ন (ইনভয়েস খোঁজা + ডেবিট নোট তৈরি)
// =================================================================
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// একটা পারচেজ ইনভয়েস থেকে প্রতিটা প্রোডাক্ট আগে কতটা ফেরত গেছে
const getReturnedQtyMap = async (db, purchaseId) => {
  const rows = await db.purchaseReturnItem.groupBy({
    by: ["productId"],
    where: { purchaseReturn: { purchaseId: Number(purchaseId) } },
    _sum: { quantity: true }
  });
  const map = {};
  rows.forEach((r) => {
    map[r.productId] = r._sum.quantity || 0;
  });
  return map;
};

// ইনভয়েসের আইটেম প্রোডাক্ট অনুযায়ী যোগ করা (একই প্রোডাক্ট দুইবার থাকলে এক করে)
const aggregatePurchasedItems = (purchaseItems = []) => {
  const agg = {};
  for (const pi of purchaseItems) {
    if (!pi.productId) continue;
    if (!agg[pi.productId]) {
      agg[pi.productId] = {
        productId: pi.productId,
        name: pi.product?.name || pi.productName || `Product #${pi.productId}`,
        purchasedQty: 0,
        totalCost: 0,
        mainStock: pi.product?.quantity ?? 0,
        damagedStock: pi.product?.damagedQuantity ?? 0
      };
    }
    agg[pi.productId].purchasedQty += Number(pi.quantity);
    agg[pi.productId].totalCost += Number(pi.totalPrice);
  }
  return agg;
};

// =================================================================
// ১. পারচেজ ইনভয়েস খোঁজা (Find Purchase Invoice for Return)
// GET /returns/find-purchase?query=INV-xxx&shopId=1
// =================================================================
export const findPurchaseForReturn = async (req, res) => {
  try {
    const { query, shopId } = req.query;

    if (!query || !shopId) {
      return res.status(400).json({ success: false, message: "Query এবং Shop ID প্রয়োজন।" });
    }

    const purchase = await prisma.purchase.findFirst({
      where: {
        shopId: Number(shopId),
        invoiceNo: { equals: query.trim(), mode: "insensitive" }
      },
      include: {
        supplier: true,
        purchaseItems: { include: { product: true } }
      }
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: "কোনো ক্রয় ইনভয়েস পাওয়া যায়নি।" });
    }

    const returnedMap = await getReturnedQtyMap(prisma, purchase.id);
    const aggregated = aggregatePurchasedItems(purchase.purchaseItems);

    const returnableItems = Object.values(aggregated).map((a) => {
      const returnedQty = returnedMap[a.productId] || 0;
      return {
        productId: a.productId,
        name: a.name,
        purchasedQty: a.purchasedQty,
        returnedQty,
        returnableQty: Math.max(0, a.purchasedQty - returnedQty),
        unitCost: a.purchasedQty > 0 ? round2(a.totalCost / a.purchasedQty) : 0,
        mainStock: a.mainStock,
        damagedStock: a.damagedStock
      };
    });

    return res.status(200).json({ success: true, data: { ...purchase, returnableItems } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ২. সাপ্লায়ার রিটার্ন তৈরি (Create Purchase Return)
// =================================================================
export const createPurchaseReturn = async (req, res) => {
  try {
    const {
      shopId,
      purchaseId,
      accountId,
      items,
      settlementType,
      reason,
      notes
    } = req.body;

    const createdById = req.user?.id || req.body.createdById;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "কমপক্ষে একটি পণ্য নির্বাচন করুন।" });
    }
    if (!["REDUCE_PAYABLE", "CASH_REFUND"].includes(settlementType)) {
      return res.status(400).json({ success: false, message: "সেটেলমেন্ট পদ্ধতি সঠিক নয়।" });
    }
    if (!purchaseId) {
      return res.status(400).json({ success: false, message: "ক্রয় ইনভয়েস নির্বাচন করুন।" });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // ---------- ১. ইনভয়েস লোড ও ভ্যালিডেশন ----------
        const purchase = await tx.purchase.findFirst({
          where: { id: Number(purchaseId), shopId: Number(shopId) },
          include: { purchaseItems: { include: { product: true } } }
        });
        if (!purchase) throw new Error("মূল ক্রয় ইনভয়েস পাওয়া যায়নি।");

        const purchasedMap = aggregatePurchasedItems(purchase.purchaseItems);
        const returnedMap = await getReturnedQtyMap(tx, purchase.id);

        // ক্লায়েন্টের দেওয়া দাম বিশ্বাস না করে ইনভয়েস থেকেই দাম নেওয়া হচ্ছে
        const requestedPerProduct = {};
        const cleanItems = items.map((item) => {
          const productId = Number(item.productId);
          const quantity = Number(item.quantity);

          if (!(quantity > 0)) throw new Error("ফেরত সংখ্যা ০-এর বেশি হতে হবে।");

          const p = purchasedMap[productId];
          if (!p) throw new Error("নির্বাচিত পণ্য এই ইনভয়েসে নেই।");

          requestedPerProduct[productId] = (requestedPerProduct[productId] || 0) + quantity;
          const returnable = p.purchasedQty - (returnedMap[productId] || 0);

          if (requestedPerProduct[productId] > returnable) {
            throw new Error(`"${p.name}"-এর সর্বোচ্চ ফেরতযোগ্য সংখ্যা ${returnable}।`);
          }

          return {
            productId,
            quantity,
            unitCost: round2(p.totalCost / p.purchasedQty),
            sourceLocation: item.sourceLocation === "DAMAGED" ? "DAMAGED" : "MAIN"
          };
        });

        const totalAmount = round2(
          cleanItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
        );

        // ---------- ২. সেটেলমেন্ট ভ্যালিডেশন ----------
        if (settlementType === "REDUCE_PAYABLE" && totalAmount > purchase.due_amount + 0.001) {
          throw new Error(
            `রিটার্ন মূল্য (৳${totalAmount}) ইনভয়েসের বকেয়া (৳${purchase.due_amount})-এর চেয়ে বেশি। Cash Refund বেছে নিন।`
          );
        }

        if (settlementType === "CASH_REFUND") {
          const prevCash = await tx.purchaseReturn.aggregate({
            where: { purchaseId: purchase.id, settlementType: "CASH_REFUND" },
            _sum: { totalAmount: true }
          });
          const refundable = purchase.paid_amount - (prevCash._sum.totalAmount || 0);
          if (totalAmount > refundable + 0.001) {
            throw new Error(`নগদ ফেরতযোগ্য সর্বোচ্চ পরিমাণ ৳${Math.max(0, round2(refundable))} (পরিশোধিত টাকার মধ্যে)।`);
          }
        }

        // ---------- ৩. ডেবিট নোট তৈরি ----------
        const debitNoteNo = `DN-${Date.now().toString().slice(-6)}`;

        const purchaseReturn = await tx.purchaseReturn.create({
          data: {
            debitNoteNo,
            shopId: Number(shopId),
            supplierId: purchase.supplier_id,
            purchaseId: purchase.id,
            createdById: Number(createdById),
            totalAmount,
            settlementType,
            reason,
            notes,
            items: {
              create: cleanItems.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitCost: i.unitCost,
                totalCost: round2(i.quantity * i.unitCost),
                sourceLocation: i.sourceLocation
              }))
            }
          },
          include: { items: true }
        });

        // ---------- ৪. স্টক ও ইনভেন্টরি লেয়ার আপডেট ----------
        for (const item of cleanItems) {
          const { productId, quantity: qty } = item;

          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error(`প্রোডাক্ট পাওয়া যায়নি: ID ${productId}`);

          if (item.sourceLocation === "DAMAGED") {
            if (product.damagedQuantity < qty) {
              throw new Error(`${product.name}-এর পর্যাপ্ত ড্যামেজ স্টক নেই।`);
            }

            const updated = await tx.product.update({
              where: { id: productId },
              data: { damagedQuantity: { decrement: qty } }
            });

            await tx.stockLog.create({
              data: {
                productId,
                userId: Number(createdById),
                changeType: "RETURN_OUTWARD",
                quantityChanged: qty,
                previousStock: product.damagedQuantity,
                newStock: updated.damagedQuantity,
                note: `Supplier Return Debit Note #${debitNoteNo} (Damaged Stock)`
              }
            });
          } else {
            if (product.quantity < qty) {
              throw new Error(`${product.name}-এর পর্যাপ্ত স্টক নেই।`);
            }

            const updated = await tx.product.update({
              where: { id: productId },
              data: { quantity: { decrement: qty } }
            });

            // এই ইনভয়েসের নিজের লেয়ার আগে কাটা হবে, তারপর বাকিগুলো FIFO-তে
            const layers = await tx.inventoryLayer.findMany({
              where: { productId, remainingQty: { gt: 0 } },
              orderBy: { createdAt: "asc" }
            });
            layers.sort(
              (a, b) => (b.purchaseId === purchase.id ? 1 : 0) - (a.purchaseId === purchase.id ? 1 : 0)
            );

            let qtyToDeduct = qty;
            for (const layer of layers) {
              if (qtyToDeduct <= 0) break;
              const take = Math.min(layer.remainingQty, qtyToDeduct);
              await tx.inventoryLayer.update({
                where: { id: layer.id },
                data: { remainingQty: { decrement: take } }
              });
              qtyToDeduct -= take;
            }

            if (qtyToDeduct > 0) {
              throw new Error(
                `"${product.name}" প্রোডাক্টের ইনভেন্টরি লেয়ারে পর্যাপ্ত স্টক নেই (ডেটা সিঙ্ক সমস্যা)। অনুগ্রহ করে স্টক এডজাস্ট করে আবার চেষ্টা করুন।`
              );
            }

            await tx.stockLog.create({
              data: {
                productId,
                userId: Number(createdById),
                changeType: "RETURN_OUTWARD",
                quantityChanged: qty,
                previousStock: product.quantity,
                newStock: updated.quantity,
                note: `Supplier Return Debit Note #${debitNoteNo}`
              }
            });
          }
        }

        // ---------- ৫. হিসাব নিষ্পত্তি ----------
        if (settlementType === "REDUCE_PAYABLE") {
          const newDue = Math.max(0, round2(purchase.due_amount - totalAmount));
          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              due_amount: newDue,
              payment_status: newDue === 0 ? "Paid" : purchase.paid_amount > 0 ? "Partial" : "Due"
            }
          });
        }

        if (settlementType === "CASH_REFUND" && totalAmount > 0) {
          let account = null;

          if (accountId) {
            account = await tx.account.findFirst({
              where: { id: Number(accountId), shopId: Number(shopId) }
            });
          }
          if (!account) {
            account =
              (await tx.account.findFirst({
                where: { shopId: Number(shopId), type: "CASH", isDefault: true }
              })) || (await tx.account.findFirst({ where: { shopId: Number(shopId) } }));
          }
          if (!account) throw new Error("রিফান্ড গ্রহণের জন্য কোনো অ্যাকাউন্ট পাওয়া যায়নি।");

          // সাপ্লায়ার টাকা ফেরত দিচ্ছে → অ্যাকাউন্টে জমা (IN)
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: totalAmount } }
          });

          await tx.transaction.create({
            data: {
              shopId: Number(shopId),
              accountId: account.id,
              type: "IN",
              amount: totalAmount,
              category: "PURCHASE_RETURN",
              referenceId: purchaseReturn.id,
              note: `Refund from Supplier - Debit Note: ${debitNoteNo}`,
              date: new Date().toISOString().split("T")[0],
              createdById: Number(createdById)
            }
          });
        }

        return purchaseReturn;
      },
      {
        maxWait: 5000,
        timeout: 20000
      }
    );

    return res.status(201).json({
      success: true,
      message: "সাপ্লায়ার রিটার্ন সম্পন্ন হয়েছে এবং ডেবিট নোট জেনারেট হয়েছে।",
      data: result
    });
  } catch (error) {
    console.error("Purchase Return Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৪. রিটার্ন হিস্ট্রি দেখার মেথডসমূহ — অপরিবর্তিত
// =================================================================
export const getCustomerReturns = async (req, res) => {
  try {
    const { shopId } = req.params;
    const returns = await prisma.customerReturn.findMany({
      where: { shopId: Number(shopId) },
      include: {
        customer: true,
        sale: true,
        receivedBy: { select: { id: true, name: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.status(200).json({ success: true, data: returns });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPurchaseReturns = async (req, res) => {
  try {
    const { shopId } = req.params;
    const returns = await prisma.purchaseReturn.findMany({
      where: { shopId: Number(shopId) },
      include: {
        supplier: true,
        purchase: true,
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.status(200).json({ success: true, data: returns });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};