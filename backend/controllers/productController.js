import prisma from "../config/db.js";

// ১. সব প্রোডাক্ট ক্যাটাগরিসহ গেট করা (শপ ফিল্টারিং সহ)
// ১. সব প্রোডাক্ট ক্যাটাগরিসহ গেট করা (প্রত্যেক ইউজার শুধুমাত্র তার নিজস্ব শপের প্রোডাক্ট দেখবে)
export const getProducts = async (req, res) => {
  try {
    const { shopId } = req.user; // 💡 রোল নির্বিশেষে সরাসরি ইউজারের শপ আইডি নেওয়া হলো
    let whereCondition = {};

    // 🔒 সিকিউরিটি চেক: যে কোনো ইউজার (ADMIN/MANAGER/CASHIER) এর শপ আইডি না থাকলে এরর দেবে
    if (!shopId) {
      return res.status(400).json({ message: "আপনার কোনো নির্দিষ্ট শপ অ্যাসাইন করা নেই।" });
    }
    
    // শুধুমাত্র ওই নির্দিষ্ট শপের প্রোডাক্টগুলো ফিল্টার করবে
    whereCondition.shopId = Number(shopId);

    const products = await prisma.product.findMany({
      where: whereCondition,
      include: {
        category: true, 
      },
      orderBy: {
        createdAt: "desc", 
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

// ২. নতুন প্রোডাক্ট তৈরি করা (Database-এ সংরক্ষণ + shopId ট্যাগিং)
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      sku, 
      category,        
      quantity,        
      unit,            
      purchasePrice,   
      sellingPrice,    
      description,
      requestShopId    
    } = req.body;

    const { role, shopId } = req.user; 

    // 💡 শপ আইডি নির্ধারণের লজিক (টোকেনে না থাকলে বডি থেকে নিয়ে ব্যাকআপ সেফটি নিশ্চিত করা হলো)
    let targetShopId = role === "ADMIN" ? (requestShopId || shopId) : (shopId || requestShopId);

    if (!targetShopId) {
      return res.status(403).json({ 
        message: "আপনার এই শপে প্রোডাক্ট যোগ করার অনুমতি নেই অথবা কোনো শপ আইডি পাওয়া যায়নি।" 
      });
    }

    const finalShopId = Number(targetShopId);

    // ম্যান্ডেটরি ফিল্ডগুলোর ভ্যালিডেশন
    if (!name || !category || !unit || purchasePrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const stockQty = parseFloat(quantity) || 0;
    const pPrice = parseFloat(purchasePrice) || 0;
    const sPrice = parseFloat(sellingPrice) || 0;

    // ১. চেক করা এই নামের ক্যাটাগরি ডেটাবেজে অলরেডি আছে কিনা
    let dbCategory = await prisma.category.findFirst({
      where: {
        name: {
          equals: category.trim(),
          mode: 'insensitive' 
        }
      }
    });

    // ২. যদি ক্যাটাগরি না থাকে, তবে তৈরি করা
    if (!dbCategory) {
      dbCategory = await prisma.category.create({
        data: {
          name: category.trim()
        }
      });
    }

    // ৩. প্রোডাক্ট তৈরি করা
    const newProduct = await prisma.product.create({
      data: {
        name,
        sku: sku || `SKU-${Math.floor(Math.random() * 100000)}`,
        quantity: stockQty,
        unit: unit,
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        categoryId: dbCategory.id, 
        shopId: finalShopId, 
        description: description || null,
        status: stockQty > 0 ? "ACTIVE" : "INACTIVE" 
      },
      include: {
        category: true 
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

// ৩. প্রোডাক্ট ডিলিট করা (Database থেকে + সিকিউরিটি চেক)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    const { role, shopId } = req.user;

    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid product ID!" });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found!" });
    }

    // 🔒 সিকিউরিটি চেক: MANAGER/CASHIER অন্য শপের প্রোডাক্ট ডিলিট করতে পারবে না
    if (role !== "ADMIN" && existingProduct.shopId !== Number(shopId)) {
      return res.status(403).json({ message: "আপনি অন্য শপের প্রোডাক্ট ডিলিট করতে পারবেন না!" });
    }

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