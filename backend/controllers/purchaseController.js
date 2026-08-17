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
    const { name, company, phone, email, address } = req.body;

    const updatedSupplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: { name, company, phone, email, address },
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
// PURCHASE CONTROLLERS (FIFO Layer Integrated)
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
        inventoryLayers: true
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ২. নতুন পারচেজ সেভ করা (FIFO Inventory Layer সহ)
export const createPurchase = async (req, res) => {
  try {
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      productId, // ফ্রন্টএন্ড থেকে productId পাঠানো বাধ্যতামূলক হওয়া উচিত
      product, 
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note,
      createdBy = req.user?.id || 1
    } = req.body;

    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;

    const parsedQuantity = Number(quantity) || 0;
    const parsedUnitPrice = Number(unit_price) || 0;
    const parsedTotalAmount = Number(total_amount) || 0;
    const numericShopId = Number(shopId);

    // প্রোডাক্ট আইডি বের করা (যদি সরাসরি productId না থাকে, নাম দিয়ে খুঁজে নেওয়া)
    let targetProductId = Number(productId);
    if (!targetProductId && product) {
      const foundProd = await prisma.product.findFirst({
        where: { shopId: numericShopId, name: product }
      });
      if (foundProd) targetProductId = foundProd.id;
    }

    if (!targetProductId) {
      return res.status(400).json({ success: false, message: "Valid product or productId is required for purchase" });
    }

    // ট্রানজেকশনের মাধ্যমে পারচেজ, পারচেজ আইটেম, ইনভেন্টরি লেয়ার এবং স্টক একসাথে আপডেট করা
    const newPurchase = await prisma.$transaction(async (tx) => {
      // ১. পারচেজ রেকর্ড এবং পারচেজ আইটেম তৈরি
      const purchase = await tx.purchase.create({
        data: {
          invoiceNo,
          shopId: numericShopId,
          supplier_id: Number(supplier_id),
          date: date || new Date().toISOString().split('T')[0],
          payment_status: payment_status || "Paid",
          product: product || "General Product",
          quantity: parsedQuantity,
          unit_price: parsedUnitPrice,
          total_amount: parsedTotalAmount,
          paid_amount: Number(paid_amount) || 0,
          due_amount: Number(due_amount) || 0,
          note: note || "",
          createdBy: Number(createdBy),

          purchaseItems: {
            create: [
              {
                productId: targetProductId,
                productName: product || "General Product",
                quantity: parsedQuantity,
                unitPrice: parsedUnitPrice,
                totalPrice: parsedTotalAmount,
              }
            ]
          }
        },
        include: {
          supplier: true,
          purchaseItems: true
        }
      });

      // ২. FIFO এর জন্য নতুন Inventory Layer তৈরি করা
      await tx.inventoryLayer.create({
        data: {
          shopId: numericShopId,
          productId: targetProductId,
          purchaseId: purchase.id,
          initialQty: parsedQuantity,
          remainingQty: parsedQuantity, // শুরুতে পুরো স্টক এই লেয়ারেই থাকবে
          unitCost: parsedUnitPrice,
        }
      });

      // ৩. প্রোডাক্ট টেবিল থেকে স্টক এবং লেটেস্ট পার্চেজ প্রাইস আপডেট করা
      const existingProduct = await prisma.product.findUnique({
        where: { id: targetProductId },
      });

      if (existingProduct) {
        const previousStock = Number(existingProduct.quantity) || 0;
        const newStock = previousStock + parsedQuantity;

        await prisma.product.update({
          where: { id: targetProductId },
          data: { 
            quantity: newStock,
            purchasePrice: parsedUnitPrice 
          },
        });

        // ৪. স্টক লগ এন্ট্রি
        await tx.stockLog.create({
          data: {
            productId: targetProductId,
            userId: Number(createdBy),
            changeType: "PURCHASE",
            quantityChanged: parsedQuantity,
            previousStock: previousStock,
            newStock: newStock,
            note: `Purchase Invoice: ${invoiceNo}`,
          },
        });
      }

      return purchase;
    });

    res.status(201).json({ success: true, message: 'Purchase saved and FIFO inventory layer created successfully', data: newPurchase });
  } catch (err) {
    console.error("Create Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৩. পারচেজ আপডেট করা (PUT)
export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      product,
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note,
    } = req.body;

    const purchaseId = Number(id);
    const existingPurchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { purchaseItems: true }
    });

    if (!existingPurchase) {
      return res.status(404).json({ success: false, message: "Purchase record not found" });
    }

    const oldQuantity = Number(existingPurchase.quantity) || 0;
    const newQuantity = Number(quantity) || 0;
    const quantityDifference = newQuantity - oldQuantity;

    const parsedUnitPrice = Number(unit_price) || 0;
    const parsedTotalAmount = Number(total_amount) || 0;
    const numericShopId = Number(shopId || existingPurchase.shopId);

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      // পারচেজ রেকর্ড আপডেট
      const updated = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          supplier_id: Number(supplier_id),
          date: date || existingPurchase.date,
          payment_status: payment_status || existingPurchase.payment_status,
          product: product || existingPurchase.product,
          quantity: newQuantity,
          unit_price: parsedUnitPrice,
          total_amount: parsedTotalAmount,
          paid_amount: Number(paid_amount) || 0,
          due_amount: Number(due_amount) || 0,
          note: note || "",
        },
        include: {
          supplier: true,
          purchaseItems: true,
        },
      });

      // সংশ্লিষ্ট ইনভেন্টরি লেয়ার আপডেট করা (যেহেতু এই পারচেজ আইডি দিয়েই লেয়ার তৈরি হয়েছিল)
      const targetLayer = await tx.inventoryLayer.findFirst({
        where: { purchaseId: purchaseId }
      });

      if (targetLayer) {
        const consumedQty = Number(targetLayer.initialQty) - Number(targetLayer.remainingQty);
        const newInitialQty = newQuantity;
        const newRemainingQty = Math.max(0, newInitialQty - consumedQty);

        await tx.inventoryLayer.update({
          where: { id: targetLayer.id },
          data: {
            initialQty: newInitialQty,
            remainingQty: newRemainingQty,
            unitCost: parsedUnitPrice
          }
        });
      }

      // প্রোডাক্ট স্টক ও প্রাইস অ্যাডজাস্ট করা
      const firstItem = existingPurchase.purchaseItems[0];
      if (firstItem && firstItem.productId) {
        const existingProduct = await prisma.product.findUnique({
          where: { id: firstItem.productId },
        });

        if (existingProduct) {
          const previousStock = Number(existingProduct.quantity) || 0;
          const updatedStock = previousStock + quantityDifference;

          await prisma.product.update({
            where: { id: existingProduct.id },
            data: { 
              quantity: Math.max(0, updatedStock),
              purchasePrice: parsedUnitPrice > 0 ? parsedUnitPrice : existingProduct.purchasePrice
            },
          });
        }
      }

      return updated;
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

// ৪. পারচেজ ডিলিট করা (DELETE) - আপনার আগের কোডের প্যারামিটার ঠিক করা হয়েছে (errCode -> req)
export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseId = Number(id);

    await prisma.$transaction(async (tx) => {
      // পারচেজের সাথে যুক্ত ইনভেন্টরি লেয়ার ও স্টক হ্যান্ডেল করার লজিক চাইলে এখানে যোগ করতে পারেন
      await tx.purchase.delete({
        where: { id: purchaseId },
      });
    });

    res.status(200).json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};