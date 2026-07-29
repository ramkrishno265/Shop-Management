import prisma from "../config/db.js";

// ==========================================
// SUPPLIER CONTROLLERS
// ==========================================

// ১. নির্দিষ্ট শপ-এর সব সাপ্লায়ার ফেচ করা (GET)
// Example: GET /api/suppliers?shopId=1
export const getSuppliers = async (req, res) => {
  try {
    const { shopId } = req.query;

    const suppliers = await prisma.supplier.findMany({
      where: shopId ? { shopId: Number(shopId) } : {},
      orderBy: { id: 'desc' },
    });

    res.status(200).json(suppliers);
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

// ৫. নির্দিষ্ট শপ-এর সব পারচেজ লিস্ট ফেচ করা (GET)
// ১. সব পারচেজ নিয়ে আসা (GET) - শপ আইডি ফিল্টার সহ
export const getPurchases = async (req, res) => {
  try {
    const { shopId } = req.query;

    const purchases = await prisma.purchase.findMany({
      where: shopId ? { shopId: Number(shopId) } : {},
      include: {
        supplier: true, // সাপ্লায়ারের তথ্য
        user: {
          select: { id: true, name: true, email: true } // কোন ইউজার ক্রিয়েট করেছে
        },
        purchaseItems: true // কেনাকাটার আইটেম লিস্ট
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
      product,
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note,
      createdBy = 1 // ফলব্যাক ইউজার আইডি যদি না থাকে
    } = req.body;

    // ইউনিক ইনভয়েস নম্বর অটো জেনারেট করা
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;

    const newPurchase = await prisma.purchase.create({
      data: {
        invoiceNo,
        shopId: Number(shopId),
        supplierId: Number(supplier_id),
        createdBy: Number(createdBy),
        subtotal: Number(total_amount),
        discountAmount: 0,
        grandTotal: Number(total_amount),
        paidAmount: Number(paid_amount) || 0,
        dueAmount: Number(due_amount) || 0,
        paymentStatus: payment_status ? payment_status.toUpperCase() : "PAID",
        notes: note || "",
        // পারচেজ আইটেম টেবিলের জন্য সিঙ্গেল প্রোডাক্ট ইনফো দিয়ে ডাটা এন্ট্রি
        purchaseItems: {
          create: [
            {
              productName: product || "General Product",
              quantity: Number(quantity) || 1,
              unitPrice: Number(unit_price) || 0,
              totalPrice: Number(total_amount) || 0,
            }
          ]
        }
      },
      include: {
        supplier: true,
        purchaseItems: true
      }
    });

    res.status(201).json({ success: true, message: 'Purchase saved successfully', data: newPurchase });
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
        ...(supplier_id && { supplierId: Number(supplier_id) }),
        ...(total_amount !== undefined && { 
          subtotal: Number(total_amount),
          grandTotal: Number(total_amount) 
        }),
        ...(paid_amount !== undefined && { paidAmount: Number(paid_amount) }),
        ...(due_amount !== undefined && { dueAmount: Number(due_amount) }),
        ...(payment_status && { paymentStatus: payment_status.toUpperCase() }),
        ...(note !== undefined && { notes: note }),
        
        // যদি আইটেম আপডেট করতে হয় তবে আগেরগুলো ডিলিট করে নতুনটা এন্ট্রি বা কানেক্ট করা যায়
        ...(product && {
          purchaseItems: {
            deleteMany: {}, // আগের আইটেম মুছে নতুন আইটেম যুক্ত করবে
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