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
    const { name, company, phone, email, address, shopId } = req.body;

    if (!name || !shopId) {
      return res.status(400).json({ success: false, message: 'Name and shopId are required' });
    }

    const newSupplier = await prisma.supplier.create({
      data: {
        name,
        company,
        phone,
        email,
        address,
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
// Example: GET /api/purchases?shopId=1
export const getPurchases = async (req, res) => {
  try {
    const { shopId } = req.query;

    const purchases = await prisma.purchase.findMany({
      where: shopId ? { shopId: Number(shopId) } : {},
      include: {
        supplier: true, // সাথে সাপ্লায়ারের সব তথ্য পাওয়ার জন্য
        user: {
          select: { id: true, name: true, email: true } // কোন ইউজার ক্রিয়েট করেছে
        },
        purchaseItems: true // কেনাকাটার আইটেম লিস্ট
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json(purchases);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৬. নতুন পারচেজ সেভ করা (POST)
export const createPurchase = async (req, res) => {
  try {
    const {
      invoiceNo,
      shopId,
      supplierId,
      createdBy,
      subtotal,
      discountAmount = 0,
      grandTotal,
      paidAmount = 0,
      dueAmount = 0,
      paymentStatus = "PAID",
      notes,
      purchaseItems // অ্যারে আকারে ফ্রন্টএন্ড থেকে আইটেম পাঠানো হলে
    } = req.body;

    const newPurchase = await prisma.purchase.create({
      data: {
        invoiceNo,
        shopId: Number(shopId),
        supplierId: Number(supplierId),
        createdBy: Number(createdBy),
        subtotal: Number(subtotal),
        discountAmount: Number(discountAmount),
        grandTotal: Number(grandTotal),
        paidAmount: Number(paidAmount),
        dueAmount: Number(dueAmount),
        paymentStatus,
        notes,
        // যদি পারচেজের সাথে আইটেমও একসাথে ইনসার্ট করতে চান
        ...(purchaseItems && purchaseItems.length > 0 && {
          purchaseItems: {
            create: purchaseItems.map((item) => ({
              productId: Number(item.productId),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice)
            }))
          }
        })
      },
      include: {
        supplier: true,
        purchaseItems: true
      }
    });

    res.status(201).json({ success: true, message: 'Purchase saved successfully', data: newPurchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৭. পারচেজ আপডেট করা (PUT)
export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplierId,
      subtotal,
      discountAmount,
      grandTotal,
      paidAmount,
      dueAmount,
      paymentStatus,
      notes
    } = req.body;

    const updatedPurchase = await prisma.purchase.update({
      where: { id: Number(id) },
      data: {
        ...(supplierId && { supplierId: Number(supplierId) }),
        ...(subtotal !== undefined && { subtotal: Number(subtotal) }),
        ...(discountAmount !== undefined && { discountAmount: Number(discountAmount) }),
        ...(grandTotal !== undefined && { grandTotal: Number(grandTotal) }),
        ...(paidAmount !== undefined && { paidAmount: Number(paidAmount) }),
        ...(dueAmount !== undefined && { dueAmount: Number(dueAmount) }),
        ...(paymentStatus && { paymentStatus }),
        ...(notes !== undefined && { notes })
      },
      include: {
        supplier: true,
        purchaseItems: true
      }
    });

    res.status(200).json({ success: true, message: 'Purchase updated successfully', data: updatedPurchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৮. পারচেজ ডিলিট করা (DELETE)
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