import prisma from "../config/db.js";

// =================================================================
// ১. ইনভয়েস খোঁজা (Find Sale Invoice for Return)
// =================================================================
export const findSaleForReturn = async (req, res) => {
  try {
    const { query, shopId } = req.query;

    if (!query || !shopId) {
      return res.status(400).json({ success: false, message: "Query এবং Shop ID প্রয়োজন।" });
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
      return res.status(404).json({ success: false, message: "কোনো বিক্রয় ইনভয়েস পাওয়া যায়নি।" });
    }

    return res.status(200).json({ success: true, data: sale });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ২. কাস্টমার রিটার্ন তৈরি (Create Customer Return)
// =================================================================
export const createCustomerReturn = async (req, res) => {
  try {
    const {
      shopId,
      saleId,
      customerId,
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

    // টাইমআউট অপশন যুক্ত করে ট্রানজ্যাকশন রান করা
    const result = await prisma.$transaction(
      async (tx) => {
        // ১. ইনভয়েস ভ্যালিডেশন
        const sale = await tx.sale.findUnique({
          where: { id: Number(saleId) }
        });

        if (!sale) {
          throw new Error("মূল বিক্রয় ইনভয়েস পাওয়া যায়নি।");
        }

        // ২. মোট টাকা হিসাব
        const totalAmount = items.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
          0
        );
        const refundAmount = Math.max(0, totalAmount - Number(restockingFee));
        const returnInvoiceNo = `RET-${Date.now().toString().slice(-6)}`;

        // ৩. কাস্টমার রিটার্ন রেকর্ড তৈরি
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

        // ৪. লুপের মাধ্যমে ইনভেন্টরি ও লগ আপডেট
        for (const item of items) {
          const prodId = Number(item.productId);
          const qty = Number(item.quantity);

          const product = await tx.product.findUnique({
            where: { id: prodId },
            select: { id: true, quantity: true, damagedQuantity: true, purchasePrice: true }
          });

          if (!product) throw new Error(`প্রোডাক্ট পাওয়া যায়নি: ID ${prodId}`);

          if (item.condition === "GOOD") {
            // ভালো স্টক আপডেট
            const updatedProduct = await tx.product.update({
              where: { id: prodId },
              data: { quantity: { increment: qty } }
            });

            // FIFO লেয়ারে রিস্টোর
            await tx.inventoryLayer.create({
              data: {
                shopId: Number(shopId),
                productId: prodId,
                initialQty: qty,
                remainingQty: qty,
                unitCost: product.purchasePrice
              }
            });

            // স্টক লগ
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
            // ড্যামেজ স্টক আপডেট
            const updatedProduct = await tx.product.update({
              where: { id: prodId },
              data: { damagedQuantity: { increment: qty } }
            });

            // ড্যামেজ স্টক লগ
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

        // ৫. বকেয়া সমন্বয়
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

        return customerReturn;
      },
      {
        maxWait: 5000,  // ট্রানজ্যাকশন শুরু হতে সর্বোচ্চ ৫ সেকেন্ড অপেক্ষা করবে
        timeout: 20000  // পুরো ট্রানজ্যাকশন সম্পন্ন হতে ২০ সেকেন্ড (20000 ms) সময় পাবে
      }
    );

    return res.status(201).json({
      success: true,
      message: "কাস্টমার রিটার্ন সফলভাবে সম্পন্ন হয়েছে।",
      data: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// =================================================================
// ৩. সাপ্লায়ার রিটার্ন তৈরি (Create Purchase Return) - Fixed & Optimized
// =================================================================
export const createPurchaseReturn = async (req, res) => {
  try {
    const {
      shopId,
      supplierId,
      purchaseId,
      items,
      settlementType,
      reason,
      notes
    } = req.body;

    const createdById = req.user?.id || req.body.createdById;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "কমপক্ষে একটি পণ্য নির্বাচন করুন।" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const totalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitCost)), 0);
      const debitNoteNo = `DN-${Date.now().toString().slice(-6)}`;

      // ১. পারচেজ রিটার্ন রেকর্ড বা ডেবিট নোট তৈরি
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          debitNoteNo,
          shopId: Number(shopId),
          supplierId: Number(supplierId),
          purchaseId: purchaseId ? Number(purchaseId) : null,
          createdById: Number(createdById),
          totalAmount,
          settlementType,
          reason,
          notes,
          items: {
            create: items.map(item => ({
              productId: Number(item.productId),
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              totalCost: Number(item.quantity) * Number(item.unitCost),
              sourceLocation: item.sourceLocation || "MAIN"
            }))
          }
        },
        include: { items: true }
      });

      // ২. ইনভেন্টরি, স্টক এবং FIFO লেয়ার আপডেট লজিক
      for (const item of items) {
        const prodId = Number(item.productId);
        const qty = Number(item.quantity);

        const product = await tx.product.findUnique({ where: { id: prodId } });
        if (!product) throw new Error(`প্রোডাক্ট পাওয়া যায়নি: ID ${prodId}`);

        if (item.sourceLocation === "DAMAGED") {
          if (product.damagedQuantity < qty) {
            throw new Error(`${product.name}-এর পর্যাপ্ত ড্যামেজ স্টক নেই।`);
          }

          await tx.product.update({
            where: { id: prodId },
            data: { damagedQuantity: { decrement: qty } }
          });
        } else {
          if (product.quantity < qty) {
            throw new Error(`${product.name}-এর পর্যাপ্ত স্টক নেই।`);
          }

          // মূল স্টক কমানো
          await tx.product.update({
            where: { id: prodId },
            data: { quantity: { decrement: qty } }
          });

          // FIFO লেয়ার থেকে স্টক কাটছাট (Reverse FIFO)
          let qtyToDeduct = qty;
          const layers = await tx.inventoryLayer.findMany({
            where: { productId: prodId, remainingQty: { gt: 0 } },
            orderBy: { createdAt: "desc" }
          });

          for (const layer of layers) {
            if (qtyToDeduct <= 0) break;
            const take = Math.min(layer.remainingQty, qtyToDeduct);
            await tx.inventoryLayer.update({
              where: { id: layer.id },
              data: { remainingQty: { decrement: take } }
            });
            qtyToDeduct -= take;
          }

          // স্টক লগ তৈরি
          await tx.stockLog.create({
            data: {
              productId: prodId,
              userId: Number(createdById),
              changeType: "RETURN_OUTWARD",
              quantityChanged: qty,
              previousStock: product.quantity,
              newStock: product.quantity - qty,
              note: `Supplier Return Debit Note #${debitNoteNo}`
            }
          });
        }
      }

      // ৩. অ্যাকাউন্ট বা দেনা সমন্বয় লজিক (Settlement Adjustment)
      if (settlementType === "REDUCE_PAYABLE") {
        // যদি নির্দিষ্ট কোনো ক্রয় বিল (purchaseId) সিলেক্ট করা থাকে
        if (purchaseId) {
          const purchase = await tx.purchase.findUnique({ where: { id: Number(purchaseId) } });
          if (purchase && purchase.due_amount > 0) {
            const newDue = Math.max(0, purchase.due_amount - totalAmount);
            await tx.purchase.update({
              where: { id: Number(purchaseId) },
              data: {
                due_amount: newDue,
                payment_status: newDue === 0 ? "Paid" : "Partial"
              }
            });
          }
        } 
        
        // গ্লোবাল বা সাপ্লায়ারের লেজারে যদি কারেন্ট ব্যালেন্স ফিল্ড থাকে তা অ্যাডজাস্ট করার জন্য 
        // আপনি যদি Supplier মডেলে currentBalance ফিল্ড ব্যবহার করে থাকেন তবে নিচের কোডটি এনাবল করে দিতে পারেন:
        /*
        await tx.supplier.update({
          where: { id: Number(supplierId) },
          data: {
            currentBalance: { decrement: totalAmount }
          }
        });
        */
      }

      return purchaseReturn;
    });

    return res.status(201).json({
      success: true,
      message: "সাপ্লায়ার রিটার্ন সম্পন্ন হয়েছে এবং ডেবিট নোট জেনারেট হয়েছে।",
      data: result
    });
  } catch (error) {
    console.error("Purchase Return Error:", error); // ডিবাগিং এর জন্য কনসোলে প্রিন্ট হবে
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৪. রিটার্ন হিস্ট্রি দেখার মেথডসমূহ
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