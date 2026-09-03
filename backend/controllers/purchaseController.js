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

// ✅ ফিক্স: স্কিমায় Supplier মডেলে `company`/`email` ফিল্ড নেই — আগে এগুলো পাঠানো হলে
// Prisma validation error দিয়ে request পুরোপুরি fail করত (supplier edit কার্যত ভাঙা ছিল)।
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
// (CustomerPayment + SalePaymentAllocation-এর mirror — supplier-কে
//  দেওয়া টাকা একাধিক Purchase-এর due-এর বিপরীতে allocate করা যায়)
// ==========================================

/**
 * নির্দিষ্ট supplier-এর মোট due এবং due-থাকা purchase-গুলোর লিস্ট।
 * totalDue বের করা হয় সব purchase-এর due_amount যোগ করে —
 * যেটা প্রতিটা payment allocation-এর পর নিচের updatePurchaseDueOnPayment
 * ফাংশনে ইতিমধ্যে আপডেট হয়ে থাকে, তাই এখানে আলাদা করে হিসাব করার দরকার নেই।
 */
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

/**
 * একটি supplier payment তৈরি করা এবং সেটা এক বা একাধিক Purchase-এ allocate করা।
 * body: { shopId, supplierId, amount, paymentMethod, notes, allocations: [{purchaseId, amountApplied}, ...] }
 *
 * allocations না দিলে (undefined/empty), সবচেয়ে পুরনো (FIFO) due-থাকা purchase
 * থেকে শুরু করে অটো-অ্যালোকেট করা হয় — যাতে ফ্রন্টএন্ড থেকে খুঁটিনাটি না পাঠালেও
 * শুধু "supplier + amount" দিয়েই payment রেকর্ড করা যায়।
 */
export const createSupplierPayment = async (req, res) => {
  try {
    const {
      shopId,
      supplierId,
      amount,
      paymentMethod,
      notes,
      allocations,
      userId = req.user?.id || 1,
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

      // allocations ফ্রন্টএন্ড থেকে দেওয়া হলে সেটাই ব্যবহার করা হবে;
      // নাহলে FIFO ভিত্তিতে (পুরনো due আগে) অটো-অ্যালোকেট করা হবে।
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

        if (remaining > 0) {
          // দেওয়া টাকার পুরোটা কোনো due-এর সাথে মেলানো গেল না (advance payment) —
          // এই অতিরিক্ত অংশ কোনো purchase-এ allocate না করেই payment হিসেবে থেকে যাবে।
        }
      }

      // প্রতিটা allocation অনুযায়ী purchase-এর paid_amount/due_amount/payment_status আপডেট
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

// নির্দিষ্ট supplier-এর সব payment history
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

// একটি ভুল হয়ে যাওয়া supplier payment ডিলিট করা — সংশ্লিষ্ট allocation-গুলো
// reverse করে purchase-এর paid_amount/due_amount আবার আগের মতো ফিরিয়ে দেয়
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

    res.status(200).json({ success: true, message: "Supplier payment deleted and dues reversed successfully" });
  } catch (err) {
    console.error("Delete Supplier Payment Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// PURCHASE CONTROLLERS (FIFO Layer Integrated, Pack-Aware)
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
        user: {
          select: { id: true, name: true, email: true }
        },
        purchaseItems: true,
        inventoryLayers: true,
        pack: true, // 👈 pack info দেখানোর জন্য (কোন প্যাক দিয়ে কেনা হয়েছিল)
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * একটি প্রোডাক্ট/প্যাক-এর জন্য এন্ট্রি করা (quantity, unit_price)-কে
 * সবসময় base-unit ভিত্তিক (baseQty, unitCostPerBase) এ কনভার্ট করে।
 *
 * - standard প্রোডাক্ট: quantity = base unit সংখ্যা, unit_price = per-base-unit দাম। কনভার্সনের দরকার নেই।
 * - pack প্রোডাক্ট + packId দেওয়া হয়েছে: quantity = কয়টা প্যাক কেনা হয়েছে,
 *   unit_price = প্রতি প্যাকের দাম। multiplier দিয়ে ভাগ/গুণ করে base unit-এ আনা হয়।
 */
const resolvePurchaseConversion = ({ product, pack, enteredQuantity, enteredUnitPrice }) => {
  if (product.inventoryType === 'pack' && pack) {
    const multiplier = Number(pack.multiplier) || 1;
    return {
      baseQty: enteredQuantity * multiplier,
      unitCostPerBase: multiplier > 0 ? enteredUnitPrice / multiplier : enteredUnitPrice,
      packCount: enteredQuantity, // ProductPack.stock আপডেটের জন্য
    };
  }
  // standard প্রোডাক্ট, বা pack টাইপ কিন্তু packId দেওয়া হয়নি (তখনও raw ভ্যালুই base ধরা হয়,
  // যাতে অন্তত পুরনো raw-quantity ফ্লো ভাঙে না — কিন্তু ফ্রন্টএন্ডে packId পাঠানো বাধ্যতামূলক করা উচিত)
  return {
    baseQty: enteredQuantity,
    unitCostPerBase: enteredUnitPrice,
    packCount: 0,
  };
};

// ২. নতুন পারচেজ সেভ করা (FIFO Inventory Layer + Pack-aware, Multi-item Supported)
export const createPurchase = async (req, res) => {
  try {
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      items, // 👈 ফ্রন্টএন্ড থেকে পাঠানো items অ্যারে
      total_amount,
      paid_amount,
      due_amount,
      note,
      createdBy = req.user?.id || 1
    } = req.body;

    const numericShopId = Number(shopId);
    if (!numericShopId || !supplier_id) {
      return res.status(400).json({ success: false, message: "Shop ID and Supplier are required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one purchase item is required" });
    }

    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;

    const newPurchase = await prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const purchaseItemsData = [];
      const inventoryLayersData = [];
      const productUpdates = [];
      const stockLogsData = [];
      const packUpdates = [];

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

        // সাময়িক পারচেজ অবজেক্টের জন্য বেস ইউনিট কোয়ান্টিটি হিসাব রাখা
        // (নিচে purchase তৈরির সময় মূল data-তে এটি হ্যান্ডেল করা হবে)
        item._baseQty = baseQty;
        item._unitCostPerBase = unitCostPerBase;
        item._packCount = packCount;
        item._productRecord = productRecord;
        item._packRecord = packRecord;
      }

      // মূল Purchase রেকর্ড তৈরি
      const purchase = await tx.purchase.create({
        data: {
          invoiceNo,
          shopId: numericShopId,
          supplier_id: Number(supplier_id),
          date: date || new Date().toISOString().split('T')[0],
          payment_status: payment_status || "Paid",
          product: items.length === 1 ? (items[0].product || items[0].productName) : "Multiple Items",
          quantity: items.reduce((acc, curr) => acc + Number(curr.quantity), 0),
          unit_price: items.length === 1 ? Number(items[0].unit_price) : 0,
          total_amount: Number(total_amount) || calculatedTotal,
          paid_amount: Number(paid_amount) || 0,
          due_amount: Number(due_amount) || 0,
          note: note || "",
          createdBy: Number(createdBy),
          packId: items.length === 1 && items[0].packId ? Number(items[0].packId) : null,
          baseUnitQuantity: items.reduce((acc, curr) => acc + curr._baseQty, 0),

          purchaseItems: {
            create: purchaseItemsData
          }
        },
        include: {
          supplier: true,
          purchaseItems: true,
          pack: true,
        }
      });

      // প্রতিটা আইটেমের জন্য ইনভেন্টরি লেয়ার, স্টক এবং লগ আপডেট
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
            note: `Purchase Invoice: ${invoiceNo}${item._packRecord ? ` (Pack: ${item._packRecord.packName} x${item._packCount})` : ''}`,
          },
        });
      }

      return purchase;
    }, {
      maxWait: 15000,
      timeout: 15000
    });

    res.status(201).json({ success: true, message: 'Purchase saved and FIFO inventory layer created successfully', data: newPurchase });
  } catch (err) {
    console.error("Create Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৩. পারচেজ আপডেট করা (PUT) — pack-aware, একই transaction-এ atomic
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
        throw new Error("এই পারচেজের সাথে কোনো প্রোডাক্ট লিংক করা নেই, আপডেট করা সম্ভব নয়।");
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

      if (productRecord.inventoryType === 'pack' && !packRecord) {
        throw new Error("এটি একটি Pack প্রোডাক্ট — কোন প্যাক দিয়ে কেনা হয়েছে তা নির্বাচন করা আবশ্যক!");
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

      // ⚠️ NOTE: এই purchase-এ যদি আগে থেকে কোনো SupplierPayment allocate করা থাকে,
      // paid_amount এখানে সরাসরি overwrite করলে সেই allocation history-র সাথে
      // out-of-sync হয়ে যেতে পারে। total_amount কমানোর সময় paid_amount যেন কখনো
      // total_amount-কে ছাড়িয়ে না যায় সেটা এখানে গার্ড করা হলো।
      const safePaidAmount = paid_amount !== undefined
        ? Math.min(Number(paid_amount), parsedTotalAmount)
        : Math.min(Number(existingPurchase.paid_amount), parsedTotalAmount);
      const safeDueAmount = due_amount !== undefined
        ? Number(due_amount)
        : Math.max(0, parsedTotalAmount - safePaidAmount);

      // পারচেজ রেকর্ড আপডেট
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

      // সংশ্লিষ্ট ইনভেন্টরি লেয়ার আপডেট (base-unit ভিত্তিক)
      const targetLayer = await tx.inventoryLayer.findFirst({
        where: { purchaseId: purchaseId }
      });

      if (targetLayer) {
        const consumedQty = Number(targetLayer.initialQty) - Number(targetLayer.remainingQty);
        if (consumedQty > newBaseQty) {
          throw new Error(
            `এই পারচেজ থেকে ইতিমধ্যে ${consumedQty} ইউনিট বিক্রি হয়ে গেছে, যা নতুন quantity (${newBaseQty}) থেকে কম করা যাবে না।`
          );
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

      // Product স্টক atomic adjust (base-unit ডিফারেন্স দিয়ে, raw quantity দিয়ে না)
      const previousStock = Number(productRecord.quantity) || 0;
      const newStock = Math.max(0, previousStock + baseQtyDifference);

      await tx.product.update({
        where: { id: productRecord.id },
        data: {
          quantity: { increment: baseQtyDifference },
          purchasePrice: unitCostPerBase > 0 ? unitCostPerBase : productRecord.purchasePrice,
        },
      });

      // পুরনো ও নতুন প্যাক আলাদা হলে দুই জায়গার stock ঠিক করা; একই হলে diff apply করা
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
      message: "Purchase updated and FIFO inventory layer adjusted successfully!",
      data: updatedPurchase,
    });
  } catch (err) {
    console.error("Update Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৪. পারচেজ ডিলিট করা (DELETE) — এখন স্টক ও pack-stock reverse করে,
// এবং লেয়ার থেকে ইতিমধ্যে বিক্রি হয়ে যাওয়া অংশ থাকলে ডিলিট আটকায় (data-integrity সেফটি)
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

      // ⚠️ NEW GUARD: এই purchase-এর বিপরীতে যদি ইতিমধ্যে কোনো SupplierPayment
      // allocate করা থাকে, তাহলে ডিলিট করলে সেই payment history orphan হয়ে যাবে
      // (foreign key onDelete: Cascade থাকায় allocation রো নিজেও মুছে যাবে, কিন্তু
      // supplier payment-এর টাকাটা তখন কোনো purchase-এর সাথে ম্যাপড থাকবে না)।
      const existingAllocations = await tx.purchasePaymentAllocation.findMany({
        where: { purchaseId },
      });
      if (existingAllocations.length > 0) {
        const allocatedTotal = existingAllocations.reduce((sum, a) => sum + Number(a.amountApplied), 0);
        throw new Error(
          `এই পারচেজের বিপরীতে ইতিমধ্যে ${allocatedTotal} টাকা supplier payment allocate করা আছে, তাই এটি ডিলিট করা যাবে না। (আগে সংশ্লিষ্ট payment allocation বাতিল করুন)`
        );
      }

      const layer = await tx.inventoryLayer.findFirst({ where: { purchaseId } });

      // ✅ আগে delete শুধু purchase রো মুছত — product.quantity, pack.stock, বা
      // InventoryLayer কিছুই reverse হতো না, ফলে ডিলিটের পরও স্টক বাড়তি থেকে যেত।
      if (layer) {
        const consumedQty = Number(layer.initialQty) - Number(layer.remainingQty);
        if (consumedQty > 0) {
          // এই লেয়ার থেকে ইতিমধ্যে কিছু বিক্রি হয়ে গেছে — সেই sale-এর cost এই লেয়ারের
          // উপর নির্ভরশীল, তাই layer/purchase মুছে ফেললে ঐ পুরনো sale-এর cost history
          // ভেঙে যাবে। নিরাপদ না হওয়া পর্যন্ত ডিলিট block করা হলো।
          throw new Error(
            `এই পারচেজ থেকে ${consumedQty} ইউনিট ইতিমধ্যে বিক্রি হয়ে গেছে, তাই এটি ডিলিট করা যাবে না। (রিভার্স করতে হলে আগে সংশ্লিষ্ট sale বাতিল করুন)`
          );
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

    res.status(200).json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) {
    console.error("Delete Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};