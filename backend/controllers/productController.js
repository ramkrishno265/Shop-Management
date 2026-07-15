import prisma from "../config/db.js";

// ১. সব প্রোডাক্ট ক্যাটাগরিসহ গেট করা (Database থেকে)
export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true, // যাতে প্রতিটি প্রোডাক্টের সাথে তার ক্যাটাগরির অবজেক্টও চলে আসে
      },
      orderBy: {
        createdAt: "desc", // নতুন এড করা প্রোডাক্টগুলো লিস্টের শুরুতে দেখাবে
      },
    });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ 
      message: "Server error while fetching products", 
      error: error.message 
    });
  }
};

// ২. নতুন প্রোডাক্ট তৈরি করা (Database-এ সংরক্ষণ)
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      sku, 
      category,        // ফ্রন্টএন্ড থেকে ক্যাটাগরির নাম (String) আসবে
      quantity,        // প্রোডাক্টের স্টক বা পরিমাণ
      unit,            // e.g. KG, Liter, Pcs, GM ইত্যাদি
      purchasePrice,   // কেনার দাম
      sellingPrice,    // বিক্রির দাম
      description      // প্রোডাক্টের বিবরণ (অপশনাল)
    } = req.body;

    // ম্যান্ডেটরি ফিল্ডগুলোর ভ্যালিডেশন
    if (!name || !category || !unit || purchasePrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const stockQty = parseFloat(quantity) || 0;
    const pPrice = parseFloat(purchasePrice) || 0;
    const sPrice = parseFloat(sellingPrice) || 0;

    // ১. চেক করা এই নামের ক্যাটাগরি ডেটাবেজে অলরেডি আছে কিনা (Case Insensitive)
    let dbCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: category.trim(),
          mode: 'insensitive' // ক্যাপিটাল বা স্মল লেটার যাই হোক, মিল থাকলে সেটিই ধরবে
        }
      }
    });

    // ২. যদি ক্যাটাগরি না থাকে, তবে সেটি অটোমেটিক নতুন ক্যাটাগরি হিসেবে তৈরি করা
    if (!dbCategory) {
      dbCategory = await prisma.category.create({
        data: {
          name: category.trim()
        }
      });
    }

    // ৩. নতুন স্কিমা অনুযায়ী প্রোডাক্ট তৈরি করা
    const newProduct = await prisma.product.create({
      data: {
        name,
        sku: sku || `SKU-${Math.floor(Math.random() * 100000)}`,
        quantity: stockQty,
        unit: unit,
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        categoryId: dbCategory.id, // ক্যাটাগরির অটো-ক্যালকুলেটেড আইডি এখানে বসবে
        description: description || null,
        status: stockQty > 0 ? "ACTIVE" : "INACTIVE" // স্টক শূন্যের বেশি থাকলে ACTIVE, অন্যথায় INACTIVE
      },
      include: {
        category: true // রেসপন্সে ক্যাটাগরি ইনফোও রিটার্ন করবে
      }
    });

    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ 
      message: "Server error while saving product", 
      error: error.message 
    });
  }
};

// ৩. প্রোডাক্ট ডিলিট করা (Database থেকে)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid product ID!" });
    }

    // প্রথমে প্রোডাক্টটি ডেটাবেজে আছে কিনা তা চেক করা
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found!" });
    }

    // ডেটাবেজ থেকে মুছে ফেলা
    await prisma.product.delete({
      where: { id: productId },
    });

    res.status(200).json({ message: "Product deleted successfully!" });
  } catch (error) {
    res.status(500).json({ 
      message: "Server error while deleting product", 
      error: error.message 
    });
  }
};