import prisma from "../config/db.js";

// Utility: শপ আইডি ভ্যালিডেশন
const validateShopAccess = (user, requestShopId) => {
  const userShopId = Number(user.shopId);
  const targetShopId = requestShopId ? Number(requestShopId) : userShopId;
  
  // ADMIN সব শপ অ্যাক্সেস করতে পারবে, অন্যরা শুধু তাদের নিজস্ব শপ
  if (user.role !== "ADMIN" && targetShopId !== userShopId) {
    return null;
  }
  return targetShopId;
};

// ১. Get Products
export const getProducts = async (req, res) => {
  try {
    const { shopId } = req.user;
    if (!shopId) return res.status(400).json({ message: "Shop assignment missing." });

    const products = await prisma.product.findMany({
      where: { shopId: Number(shopId) },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

// ২. Create Product
export const createProduct = async (req, res) => {
  try {
    const { name, sku, category, quantity, unit, purchasePrice, sellingPrice, description, requestShopId } = req.body;

    // শপ আইডি নির্ধারণ
    const finalShopId = validateShopAccess(req.user, requestShopId);
    if (!finalShopId) return res.status(403).json({ message: "Access denied or Invalid Shop ID." });

    // ভ্যালিডেশন
    if (!name || !category || !unit || purchasePrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // ক্যাটাগরি হ্যান্ডলিং
    let dbCategory = await prisma.category.findFirst({
      where: { name: { equals: category.trim(), mode: 'insensitive' } }
    });

    if (!dbCategory) {
      dbCategory = await prisma.category.create({ data: { name: category.trim() } });
    }

    // প্রোডাক্ট ক্রিয়েশন
    const newProduct = await prisma.product.create({
      data: {
        name,
        sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
        quantity: parseFloat(quantity) || 0,
        unit,
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        categoryId: dbCategory.id,
        shopId: finalShopId,
        description,
        status: parseFloat(quantity) > 0 ? "ACTIVE" : "INACTIVE"
      },
      include: { category: true }
    });

    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: "Error creating product", error: error.message });
  }
};

// ৩. Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { role, shopId } = req.user;

    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
    if (!existingProduct) return res.status(404).json({ message: "Product not found." });

    // সিকিউরিটি চেক
    if (role !== "ADMIN" && existingProduct.shopId !== Number(shopId)) {
      return res.status(403).json({ message: "Unauthorized: Access denied." });
    }

    await prisma.product.delete({ where: { id: productId } });
    res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error: error.message });
  }
};