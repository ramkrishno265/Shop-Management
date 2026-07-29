import prisma from "../config/db.js";

// ==========================================
// SUPPLIER CONTROLLERS
// ==========================================

// ১. নির্দিষ্ট শপ-এর সব সাপ্লায়ার ফেচ করা (GET)
// Example: GET /api/suppliers?shopId=1
export const getSuppliers = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    // যদি শপ আইডি না থাকে, তবে খালি অ্যারে রিটার্ন করবে
    if (!shopId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { shopId: Number(shopId) }, // বাধ্যতামূলকভাবে নির্দিষ্ট শপ আইডি ফিল্টার
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ২. নতুন সাপ্লায়ার যোগ করা (POST)
export const createSupplier = async (req, res) => {
    try {
      const { name, phone, address, note, shopId } = req.body;
  
      // ফ্রন্টএন্ড এবং নতুন স্কিমা অনুযায়ী name এবং shopId বাধ্যতামূলক করা হলো
      if (!name || !shopId) {
        return res.status(400).json({ success: false, message: 'Name and shopId are required' });
      }
  
      const newSupplier = await prisma.supplier.create({
        data: {
          name,
          phone,
          address,
          note, // নতুন ফিল্ড যুক্ত করা হলো
          shopId: Number(shopId)
        },
      });
  
      res.status(201).json({ success: true, message: 'Supplier added successfully', data: newSupplier });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

// ৩. সাপ্লায়ার আপডেট করা (PUT)
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

// ৪. সাপ্লায়ার ডিলিট করা (DELETE)
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
// PURCHASE CONTROLLERS
// ==========================================

/// ১. সব পারচেজ নিয়ে আসা (GET)
export const getPurchases = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    // যদি কোনো শপ আইডি পাওয়া না যায়, তবে সিকিউরিটির জন্য খালি লিস্ট রিটার্ন করবে
    if (!shopId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const purchases = await prisma.purchase.findMany({
      where: { shopId: Number(shopId) }, // বাধ্যতামূলকভাবে নির্দিষ্ট শপ আইডি ফিল্টার
      include: {
        supplier: true,
        user: {
          select: { id: true, name: true, email: true }
        },
        purchaseItems: true
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ২. নতুন পারচেজ সেভ করা (POST)
export const createPurchase = async (req, res) => {
  try {
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      product, // এটি পণ্যের নাম হতে পারে
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note,
      createdBy = req.user?.id || 1 // লগইন করা ইউজারের আইডি থাকলে তা নিবে, না হলে ফলব্যাক
    } = req.body;

    // অটো ইউনিক ইনভয়েস নম্বর জেনারেট
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;

    const parsedQuantity = Number(quantity) || 0;
    const parsedUnitPrice = Number(unit_price) || 0;
    const parsedTotalAmount = Number(total_amount) || 0;

    // ১. পারচেজ রেকর্ড এবং পারচেজ আইটেম একসাথে তৈরি
    const newPurchase = await prisma.purchase.create({
      data: {
        invoiceNo,
        shopId: Number(shopId),
        supplier_id: Number(supplier_id),
        date: date || new Date().toISOString().split('T')[0],
        payment_status: payment_status || "Paid",
        product: product,
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

    // ২. প্রোডাক্ট টেবিল থেকে ওই শপের আন্ডারে প্রোডাক্টটি খুঁজে স্টক আপডেট করা
    const existingProduct = await prisma.product.findFirst({
      where: {
        shopId: Number(shopId),
        name: product, // নাম দিয়ে ম্যাচ করা হচ্ছে (যদি নাম হুবহু মিলে যায়)
      },
    });

    if (existingProduct) {
      const previousStock = existingProduct.quantity;
      const newStock = previousStock + parsedQuantity;

      // প্রোডাক্টের পরিমাণ (quantity) আপডেট করা
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: { quantity: newStock },
      });

      // স্টক লগে (StockLog) এন্ট্রি রাখা যাতে হিস্ট্রি থাকে
      await prisma.stockLog.create({
        data: {
          productId: existingProduct.id,
          userId: Number(createdBy),
          changeType: "PURCHASE",
          quantityChanged: parsedQuantity,
          previousStock: previousStock,
          newStock: newStock,
          note: `Purchase Invoice: ${invoiceNo}`,
        },
      });
    }

    res.status(201).json({ success: true, message: 'Purchase saved and stock updated successfully', data: newPurchase });
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
      supplier_id,
      date,
      payment_status,
      product,
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note
    } = req.body;

    const updatedPurchase = await prisma.purchase.update({
      where: { id: Number(id) },
      data: {
        ...(supplier_id && { supplier_id: Number(supplier_id) }),
        ...(date && { date }),
        ...(payment_status && { payment_status }),
        ...(product && { product }),
        ...(quantity !== undefined && { quantity: Number(quantity) }),
        ...(unit_price !== undefined && { unit_price: Number(unit_price) }),
        ...(total_amount !== undefined && { total_amount: Number(total_amount) }),
        ...(paid_amount !== undefined && { paid_amount: Number(paid_amount) }),
        ...(due_amount !== undefined && { due_amount: Number(due_amount) }),
        ...(note !== undefined && { note }),

        // আইটেম আপডেট করার সময় আগেরগুলো ডিলিট করে নতুনটা আপডেট করা
        ...(product && {
          purchaseItems: {
            deleteMany: {},
            create: [
              {
                productName: product,
                quantity: Number(quantity) || 1,
                unitPrice: Number(unit_price) || 0,
                totalPrice: Number(total_amount) || 0,
              }
            ]
          }
        })
      },
      include: {
        supplier: true,
        purchaseItems: true
      }
    });

    res.status(200).json({ success: true, message: 'Purchase updated successfully', data: updatedPurchase });
  } catch (err) {
    console.error("Update Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৪. পারচেজ ডিলিট করা (DELETE)
export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.purchase.delete({
      where: { id: Number(id) },
    });

    res.status(200).json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};