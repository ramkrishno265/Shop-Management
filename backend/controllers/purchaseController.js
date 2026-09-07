import prisma from "../config/db.js";

// ==========================================
// SUPPLIER CONTROLLERS
// ==========================================

export const getSuppliers = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    if (!shopId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { shopId: Number(shopId) },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const { name, phone, address, note, shopId } = req.body;

    if (!name || !shopId) {
      return res.status(400).json({ success: false, message: 'Name and shopId are required' });
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        name,
        phone,
        address,
        note,
        shopId: Number(shopId)
      },
    });

    res.status(201).json({ success: true, message: 'Supplier added successfully', data: newSupplier });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, note } = req.body;

    const updatedSupplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: { name, phone, address, note },
    });

    res.status(200).json({ success: true, message: 'Supplier updated successfully', data: updatedSupplier });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.supplier.delete({
      where: { id: Number(id) },
    });

    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// SUPPLIER DUE / PAYMENT CONTROLLERS
// ==========================================

export const getSupplierDue = async (req, res) => {
  try {
    const { supplierId } = req.params;

    if (!supplierId) {
      return res.status(400).json({ success: false, message: "supplierId is required" });
    }

    const purchases = await prisma.purchase.findMany({
      where: { supplier_id: Number(supplierId) },
      select: {
        id: true,
        invoiceNo: true,
        date: true,
        total_amount: true,
        paid_amount: true,
        due_amount: true,
        payment_status: true,
      },
      orderBy: { id: 'desc' },
    });

    const totalDue = purchases.reduce((sum, p) => sum + Number(p.due_amount || 0), 0);
    const totalPurchased = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const totalPaid = purchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);

    res.status(200).json({
      success: true,
      data: { totalDue, totalPurchased, totalPaid, purchases },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createSupplierPayment = async (req, res) => {
  try {
    const {
      shopId,
      supplierId,
      amount,
      paymentMethod,
      notes,
      allocations,
      accountId, // 👈 কোন অ্যাকাউন্ট থেকে টাকা দেওয়া হলো (যেমন: ক্যাশ বা ব্যাংক অ্যাকাউন্ট আইডি)
      userId = req.user?.id ,
    } = req.body;

    const numericShopId = Number(shopId);
    const numericSupplierId = Number(supplierId);
    const paymentAmount = Number(amount) || 0;

    if (!numericShopId || !numericSupplierId) {
      return res.status(400).json({ success: false, message: "shopId and supplierId are required" });
    }
    if (paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: "amount must be greater than 0" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // ১. অ্যাকাউন্ট ব্যালেন্স চেক ও ডিডাকশন (যদি নির্দিষ্ট অ্যাকাউন্ট আইডি দেওয়া হয়)
      let targetAccountId = accountId ? Number(accountId) : null;
      if (!targetAccountId) {
        // যদি অ্যাকাউন্ট আইডি না পাঠানো হয়, তবে শপের ডিফল্ট ক্যাশ অ্যাকাউন্ট খুঁজে নেওয়া হবে
        const defaultAccount = await tx.account.findFirst({
          where: { shopId: numericShopId, type: 'CASH', isDefault: true }
        }) || await tx.account.findFirst({
          where: { shopId: numericShopId }
        });

        if (!defaultAccount) {
          throw new Error("এই শপের জন্য কোনো অ্যাকাউন্ট (Account) পাওয়া যায়নি! দয়া করে আগে অ্যাকাউন্ট তৈরি করুন।");
        }
        targetAccountId = defaultAccount.id;
      }

      const account = await tx.account.findUnique({ where: { id: targetAccountId } });
      if (!account || account.balance < paymentAmount) {
        throw new Error(`অপর্যাপ্ত ব্যালেন্স! অ্যাকাউন্টে (${account?.name || 'Selected Account'}) পর্যাপ্ত টাকা নেই।`);
      }

      // অ্যাকাউন্টের ব্যালেন্স কমানো
      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { decrement: paymentAmount } }
      });

      // ২. Supplier Payment রেকর্ড তৈরি
      const payment = await tx.supplierPayment.create({
        data: {
          shopId: numericShopId,
          supplierId: numericSupplierId,
          userId: Number(userId),
          amount: paymentAmount,
          paymentMethod: paymentMethod || "CASH",
          notes: notes || "",
        },
      });

      // ৩. সেন্ট্রাল ট্রানজাকশন লেজারে এন্ট্রি (OUT)
      await tx.transaction.create({
        data: {
          shopId: numericShopId,
          accountId: targetAccountId,
          type: 'OUT',
          amount: paymentAmount,
          category: 'SUPPLIER_PAYMENT',
          referenceId: payment.id,
          note: `Supplier Payment to ID: ${numericSupplierId} - ${notes || ''}`,
          date: new Date().toISOString().split('T')[0],
          createdById: Number(userId),
        }
      });

      let resolvedAllocations = allocations;

      if (!resolvedAllocations || !Array.isArray(resolvedAllocations) || resolvedAllocations.length === 0) {
        const duePurchases = await tx.purchase.findMany({
          where: { supplier_id: numericSupplierId, due_amount: { gt: 0 } },
          orderBy: { id: 'asc' },
        });

        let remaining = paymentAmount;
        resolvedAllocations = [];
        for (const p of duePurchases) {
          if (remaining <= 0) break;
          const applied = Math.min(remaining, Number(p.due_amount));
          resolvedAllocations.push({ purchaseId: p.id, amountApplied: applied });
          remaining -= applied;
        }
      }

      for (const a of resolvedAllocations) {
        const purchase = await tx.purchase.findUnique({ where: { id: Number(a.purchaseId) } });
        if (!purchase) {
          throw new Error(`Purchase ID ${a.purchaseId} খুঁজে পাওয়া যায়নি!`);
        }

        const applyAmount = Number(a.amountApplied) || 0;
        if (applyAmount <= 0) continue;

        if (applyAmount > Number(purchase.due_amount)) {
          throw new Error(
            `Purchase (${purchase.invoiceNo})-এর due ${purchase.due_amount} টাকা, কিন্তু allocate করা হচ্ছে ${applyAmount} টাকা — due-এর বেশি allocate করা যাবে না।`
          );
        }

        await tx.purchasePaymentAllocation.create({
          data: {
            purchaseId: purchase.id,
            supplierPaymentId: payment.id,
            amountApplied: applyAmount,
          },
        });

        const newPaid = Number(purchase.paid_amount) + applyAmount;
        const newDue = Math.max(0, Number(purchase.total_amount) - newPaid);

        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paid_amount: newPaid,
            due_amount: newDue,
            payment_status: newDue === 0 ? "Paid" : (newPaid > 0 ? "Partial" : "Due"),
          },
        });
      }

      return tx.supplierPayment.findUnique({
        where: { id: payment.id },
        include: {
          supplier: true,
          allocations: { include: { purchase: true } },
        },
      });
    }, {
      maxWait: 15000,
      timeout: 15000,
    });

    res.status(201).json({ success: true, message: "Supplier payment recorded successfully", data: result });
  } catch (err) {
    console.error("Create Supplier Payment Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getSupplierPayments = async (req, res) => {
  try {
    const { supplierId } = req.params;

    if (!supplierId) {
      return res.status(400).json({ success: false, message: "supplierId is required" });
    }

    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId: Number(supplierId) },
      include: {
        user: { select: { id: true, name: true } },
        allocations: { include: { purchase: { select: { id: true, invoiceNo: true } } } },
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentId = Number(id);

    await prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.findUnique({
        where: { id: paymentId },
        include: { allocations: true },
      });

      if (!payment) {
        throw new Error("Supplier payment খুঁজে পাওয়া যায়নি!");
      }

      // ১. পেমেন্টের টাকা সংশ্লিষ্ট অ্যাকাউন্ট বা ক্যাশে রিভার্স করা (Increment)
      const relatedTransaction = await tx.transaction.findFirst({
        where: { category: 'SUPPLIER_PAYMENT', referenceId: paymentId }
      });

      if (relatedTransaction) {
        await tx.account.update({
          where: { id: relatedTransaction.accountId },
          data: { balance: { increment: payment.amount } }
        });
        // ট্রানজাকশন লেজার থেকে রিমুভ করা
        await tx.transaction.delete({ where: { id: relatedTransaction.id } });
      }

      for (const alloc of payment.allocations) {
        const purchase = await tx.purchase.findUnique({ where: { id: alloc.purchaseId } });
        if (!purchase) continue;

        const newPaid = Math.max(0, Number(purchase.paid_amount) - Number(alloc.amountApplied));
        const newDue = Math.max(0, Number(purchase.total_amount) - newPaid);

        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paid_amount: newPaid,
            due_amount: newDue,
            payment_status: newDue === 0 ? "Paid" : (newPaid > 0 ? "Partial" : "Due"),
          },
        });
      }

      await tx.purchasePaymentAllocation.deleteMany({ where: { supplierPaymentId: paymentId } });
      await tx.supplierPayment.delete({ where: { id: paymentId } });
    });

    res.status(200).json({ success: true, message: "Supplier payment deleted and account balance reversed successfully" });
  } catch (err) {
    console.error("Delete Supplier Payment Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// PURCHASE CONTROLLERS (FIFO, Pack-Aware & Account Integrated)
// ==========================================

export const getPurchases = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    if (!shopId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const purchases = await prisma.purchase.findMany({
      where: { shopId: Number(shopId) },
      include: {
        supplier: true,
        user: { select: { id: true, name: true, email: true } },
        purchaseItems: true,
        inventoryLayers: true,
        pack: true,
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const resolvePurchaseConversion = ({ product, pack, enteredQuantity, enteredUnitPrice }) => {
  if (product.inventoryType === 'pack' && pack) {
    const multiplier = Number(pack.multiplier) || 1;
    return {
      baseQty: enteredQuantity * multiplier,
      unitCostPerBase: multiplier > 0 ? enteredUnitPrice / multiplier : enteredUnitPrice,
      packCount: enteredQuantity,
    };
  }
  return {
    baseQty: enteredQuantity,
    unitCostPerBase: enteredUnitPrice,
    packCount: 0,
  };
};

export const createPurchase = async (req, res) => {
  try {
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      items,
      total_amount,
      paid_amount,
      due_amount,
      note,
      accountId,
      invoiceNo, // 👈 ১. এখানে invoiceNo রিসিভ করা হলো
      createdBy = req.user?.id 
    } = req.body;

    const numericShopId = Number(shopId);
    const paidAmountVal = Number(paid_amount) || 0;

    if (!numericShopId || !supplier_id) {
      return res.status(400).json({ success: false, message: "Shop ID and Supplier are required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one purchase item is required" });
    }

    // ২. ইউজার ইনভয়েস দিলে সেটা নেবে, না দিলে অটো-জেনারেট করবে
    const finalInvoiceNo = invoiceNo && invoiceNo.trim() !== "" 
      ? invoiceNo.trim() 
      : `INV-${Date.now().toString().slice(-8)}`;

    const newPurchase = await prisma.$transaction(async (tx) => {
      // ৩. একই শপে ডুপ্লিকেট ইনভয়েস চেক করা (ঐচ্ছিক কিন্তু সুরক্ষার জন্য ভালো)
      const existingInvoice = await tx.purchase.findFirst({
        where: { shopId: numericShopId, invoiceNo: finalInvoiceNo }
      });
      if (existingInvoice) {
        throw new Error(`ইনভয়েস নম্বর "${finalInvoiceNo}" ইতিমধ্যে বিদ্যমান রয়েছে!`);
      }

      // ১. যদি paid_amount > 0 হয়, তবে অ্যাকাউন্ট ব্যালেন্স চেক এবং কাটতে হবে
      let targetAccountId = null;
      if (paidAmountVal > 0) {
        targetAccountId = accountId ? Number(accountId) : null;
        if (!targetAccountId) {
          const defaultAccount = await tx.account.findFirst({
            where: { shopId: numericShopId, type: 'CASH', isDefault: true }
          }) || await tx.account.findFirst({ where: { shopId: numericShopId } });

          if (!defaultAccount) {
            throw new Error("এই শপের জন্য কোনো অ্যাকাউন্ট পাওয়া যায়নি! পেমেন্ট করার জন্য অ্যাকাউন্ট প্রয়োজন।");
          }
          targetAccountId = defaultAccount.id;
        }

        const account = await tx.account.findUnique({ where: { id: targetAccountId } });
        if (!account || account.balance < paidAmountVal) {
          throw new Error(`অপর্যাপ্ত ব্যালেন্স! অ্যাকাউন্টে (${account?.name || 'Selected Account'}) পর্যাপ্ত টাকা নেই।`);
        }

        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: { decrement: paidAmountVal } }
        });
      }

      let calculatedTotal = 0;
      const purchaseItemsData = [];

      for (const item of items) {
        let targetProductId = Number(item.productId);
        const enteredQuantity = Number(item.quantity) || 0;
        const enteredUnitPrice = Number(item.unit_price) || 0;
        const itemTotal = enteredQuantity * enteredUnitPrice;
        calculatedTotal += itemTotal;

        if (!targetProductId && item.product) {
          const foundProd = await tx.product.findFirst({
            where: { shopId: numericShopId, name: item.product }
          });
          if (foundProd) targetProductId = foundProd.id;
        }

        const productRecord = await tx.product.findUnique({ where: { id: targetProductId } });
        if (!productRecord) {
          throw new Error(`প্রোডাক্ট (${item.product || targetProductId}) খুঁজে পাওয়া যায়নি!`);
        }

        let packRecord = null;
        if (item.packId) {
          packRecord = await tx.productPack.findUnique({ where: { id: Number(item.packId) } });
          if (!packRecord || packRecord.productId !== productRecord.id) {
            throw new Error(`নির্বাচিত প্যাকটি ${productRecord.name} প্রোডাক্টের সাথে মিলছে না!`);
          }
        }

        if (productRecord.inventoryType === 'pack' && !packRecord) {
          throw new Error(`${productRecord.name} একটি Pack প্রোডাক্ট — কোন প্যাক দিয়ে কেনা হয়েছে তা নির্বাচন করা আবশ্যক!`);
        }

        const { baseQty, unitCostPerBase, packCount } = resolvePurchaseConversion({
          product: productRecord,
          pack: packRecord,
          enteredQuantity,
          enteredUnitPrice,
        });

        purchaseItemsData.push({
          productId: targetProductId,
          productName: item.product || productRecord.name,
          quantity: enteredQuantity,
          unitPrice: enteredUnitPrice,
          totalPrice: itemTotal,
        });

        item._baseQty = baseQty;
        item._unitCostPerBase = unitCostPerBase;
        item._packCount = packCount;
        item._productRecord = productRecord;
        item._packRecord = packRecord;
      }

      // মূল Purchase রেকর্ড তৈরি (এখানে finalInvoiceNo ব্যবহার করা হয়েছে)
      const purchase = await tx.purchase.create({
        data: {
          invoiceNo: finalInvoiceNo,
          shopId: numericShopId,
          supplier_id: Number(supplier_id),
          date: date || new Date().toISOString().split('T')[0],
          payment_status: payment_status || "Paid",
          product: items.length === 1 ? (items[0].product || items[0].productName) : "Multiple Items",
          quantity: items.reduce((acc, curr) => acc + Number(curr.quantity), 0),
          unit_price: items.length === 1 ? Number(items[0].unit_price) : 0,
          total_amount: Number(total_amount) || calculatedTotal,
          paid_amount: paidAmountVal,
          due_amount: Number(due_amount) || 0,
          note: note || "",
          createdBy: Number(createdBy),
          packId: items.length === 1 && items[0].packId ? Number(items[0].packId) : null,
          baseUnitQuantity: items.reduce((acc, curr) => acc + curr._baseQty, 0),
          purchaseItems: { create: purchaseItemsData }
        },
        include: { supplier: true, purchaseItems: true, pack: true }
      });

      // পেমেন্ট করা হয়ে থাকলে সেন্ট্রাল ট্রানজাকশন লেজারে এন্ট্রি (OUT)
      if (paidAmountVal > 0 && targetAccountId) {
        await tx.transaction.create({
          data: {
            shopId: numericShopId,
            accountId: targetAccountId,
            type: 'OUT',
            amount: paidAmountVal,
            category: 'PURCHASE',
            referenceId: purchase.id,
            note: `Purchase Payment for Invoice: ${finalInvoiceNo}`,
            date: date || new Date().toISOString().split('T')[0],
            createdById: Number(createdBy),
          }
        });
      }

      for (const item of items) {
        await tx.inventoryLayer.create({
          data: {
            shopId: numericShopId,
            productId: item._productRecord.id,
            purchaseId: purchase.id,
            initialQty: item._baseQty,
            remainingQty: item._baseQty,
            unitCost: item._unitCostPerBase,
          }
        });

        const previousStock = Number(item._productRecord.quantity) || 0;
        const newStock = previousStock + item._baseQty;

        await tx.product.update({
          where: { id: item._productRecord.id },
          data: {
            quantity: { increment: item._baseQty },
            purchasePrice: item._unitCostPerBase,
          },
        });

        if (item._packRecord) {
          await tx.productPack.update({
            where: { id: item._packRecord.id },
            data: { stock: { increment: item._packCount } },
          });
        }

        await tx.stockLog.create({
          data: {
            productId: item._productRecord.id,
            userId: Number(createdBy),
            changeType: "PURCHASE",
            quantityChanged: item._baseQty,
            previousStock: previousStock,
            newStock: newStock,
            note: `Purchase Invoice: ${finalInvoiceNo}${item._packRecord ? ` (Pack: ${item._packRecord.packName} x${item._packCount})` : ''}`,
          },
        });
      }

      return purchase;
    }, {
      maxWait: 15000,
      timeout: 15000
    });

    res.status(201).json({ success: true, message: 'Purchase saved and account/inventory updated successfully', data: newPurchase });
  } catch (err) {
    console.error("Create Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      product,
      packId,
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note,
    } = req.body;

    const purchaseId = Number(id);

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const existingPurchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { purchaseItems: true, pack: true }
      });

      if (!existingPurchase) {
        throw new Error("Purchase record not found");
      }

      const firstItem = existingPurchase.purchaseItems[0];
      if (!firstItem || !firstItem.productId) {
        throw new Error("এই পারচেজের সাথে কোনো প্রোডাক্ট লিংক করা নেই।");
      }

      const productRecord = await tx.product.findUnique({ where: { id: firstItem.productId } });
      if (!productRecord) {
        throw new Error("সংশ্লিষ্ট প্রোডাক্ট খুঁজে পাওয়া যায়নি!");
      }

      const newPackId = packId !== undefined ? (packId ? Number(packId) : null) : existingPurchase.packId;
      let packRecord = null;
      if (newPackId) {
        packRecord = await tx.productPack.findUnique({ where: { id: newPackId } });
        if (!packRecord || packRecord.productId !== productRecord.id) {
          throw new Error("নির্বাচিত প্যাকটি এই প্রোডাক্টের সাথে মিলছে না!");
        }
      }

      const enteredQuantity = quantity !== undefined ? Number(quantity) : Number(existingPurchase.quantity);
      const enteredUnitPrice = unit_price !== undefined ? Number(unit_price) : Number(existingPurchase.unit_price);
      const parsedTotalAmount = total_amount !== undefined ? Number(total_amount) : Number(existingPurchase.total_amount);

      const { baseQty: newBaseQty, unitCostPerBase, packCount: newPackCount } = resolvePurchaseConversion({
        product: productRecord,
        pack: packRecord,
        enteredQuantity,
        enteredUnitPrice,
      });

      const oldBaseQty = Number(existingPurchase.baseUnitQuantity) || 0;
      const baseQtyDifference = newBaseQty - oldBaseQty;

      const safePaidAmount = paid_amount !== undefined
        ? Math.min(Number(paid_amount), parsedTotalAmount)
        : Math.min(Number(existingPurchase.paid_amount), parsedTotalAmount);
      const safeDueAmount = due_amount !== undefined
        ? Number(due_amount)
        : Math.max(0, parsedTotalAmount - safePaidAmount);

      const updated = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          supplier_id: Number(supplier_id ?? existingPurchase.supplier_id),
          date: date || existingPurchase.date,
          payment_status: payment_status || existingPurchase.payment_status,
          product: product || existingPurchase.product,
          quantity: enteredQuantity,
          unit_price: enteredUnitPrice,
          total_amount: parsedTotalAmount,
          paid_amount: safePaidAmount,
          due_amount: safeDueAmount,
          note: note !== undefined ? note : existingPurchase.note,
          packId: newPackId,
          baseUnitQuantity: newBaseQty,
        },
        include: { supplier: true, purchaseItems: true, pack: true },
      });

      const targetLayer = await tx.inventoryLayer.findFirst({
        where: { purchaseId: purchaseId }
      });

      if (targetLayer) {
        const consumedQty = Number(targetLayer.initialQty) - Number(targetLayer.remainingQty);
        if (consumedQty > newBaseQty) {
          throw new Error(`এই পারচেজ থেকে ইতিমধ্যে ${consumedQty} ইউনিট বিক্রি হয়ে গেছে, quantity কমানো যাবে না।`);
        }
        const newRemainingQty = newBaseQty - consumedQty;

        await tx.inventoryLayer.update({
          where: { id: targetLayer.id },
          data: {
            initialQty: newBaseQty,
            remainingQty: newRemainingQty,
            unitCost: unitCostPerBase,
          }
        });
      }

      const previousStock = Number(productRecord.quantity) || 0;
      const newStock = Math.max(0, previousStock + baseQtyDifference);

      await tx.product.update({
        where: { id: productRecord.id },
        data: {
          quantity: { increment: baseQtyDifference },
          purchasePrice: unitCostPerBase > 0 ? unitCostPerBase : productRecord.purchasePrice,
        },
      });

      const oldPackId = existingPurchase.packId;
      const oldPackCount = Number(existingPurchase.quantity) || 0;

      if (oldPackId && oldPackId !== newPackId) {
        await tx.productPack.update({
          where: { id: oldPackId },
          data: { stock: { decrement: oldPackCount } },
        });
      }
      if (packRecord) {
        const packCountDiff = oldPackId === newPackId ? (newPackCount - oldPackCount) : newPackCount;
        await tx.productPack.update({
          where: { id: packRecord.id },
          data: { stock: { increment: packCountDiff } },
        });
      }

      await tx.stockLog.create({
        data: {
          productId: productRecord.id,
          userId: req.user?.id || existingPurchase.createdBy,
          changeType: "ADJUST",
          quantityChanged: baseQtyDifference,
          previousStock,
          newStock,
          note: `Purchase Updated: ${existingPurchase.invoiceNo}`,
        },
      });

      return updated;
    }, {
      maxWait: 15000,
      timeout: 15000
    });

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully!",
      data: updatedPurchase,
    });
  } catch (err) {
    console.error("Update Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseId = Number(id);

    await prisma.$transaction(async (tx) => {
      const existingPurchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { purchaseItems: true },
      });

      if (!existingPurchase) {
        throw new Error("Purchase record not found");
      }

      const existingAllocations = await tx.purchasePaymentAllocation.findMany({
        where: { purchaseId },
      });
      if (existingAllocations.length > 0) {
        throw new Error("এই পারচেজের বিপরীতে supplier payment allocate করা আছে, তাই এটি ডিলিট করা যাবে না।");
      }

      // যদি এই পারচেজের বিপরীতে কোনো পেমেন্ট ক্যাশ থেকে পরিশোধ করা হয়ে থাকে, তবে তা অ্যাকাউন্টে রিভার্স করতে হবে
      const relatedTransaction = await tx.transaction.findFirst({
        where: { category: 'PURCHASE', referenceId: purchaseId }
      });

      if (relatedTransaction) {
        await tx.account.update({
          where: { id: relatedTransaction.accountId },
          data: { balance: { increment: existingPurchase.paid_amount } }
        });
        await tx.transaction.delete({ where: { id: relatedTransaction.id } });
      }

      const layer = await tx.inventoryLayer.findFirst({ where: { purchaseId } });

      if (layer) {
        const consumedQty = Number(layer.initialQty) - Number(layer.remainingQty);
        if (consumedQty > 0) {
          throw new Error("এই পারচেজ থেকে পণ্য বিক্রি হয়ে গেছে, তাই এটি ডিলিট করা যাবে না।");
        }

        const productRecord = await tx.product.findUnique({ where: { id: layer.productId } });
        if (productRecord) {
          const previousStock = Number(productRecord.quantity) || 0;
          const newStock = Math.max(0, previousStock - Number(layer.initialQty));

          await tx.product.update({
            where: { id: productRecord.id },
            data: { quantity: { decrement: Number(layer.initialQty) } },
          });

          await tx.stockLog.create({
            data: {
              productId: productRecord.id,
              userId: req.user?.id || null,
              changeType: "ADJUST",
              quantityChanged: -Number(layer.initialQty),
              previousStock,
              newStock,
              note: `Purchase Deleted: ${existingPurchase.invoiceNo}`,
            },
          });
        }

        if (existingPurchase.packId) {
          await tx.productPack.update({
            where: { id: existingPurchase.packId },
            data: { stock: { decrement: Number(existingPurchase.quantity) || 0 } },
          });
        }

        await tx.inventoryLayer.delete({ where: { id: layer.id } });
      }

      await tx.purchase.delete({ where: { id: purchaseId } });
    });

    res.status(200).json({ success: true, message: 'Purchase deleted and financial balances reversed successfully' });
  } catch (err) {
    console.error("Delete Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};