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

// ১. Get Products (সাথে প্যাক ভ্যারিয়েন্টগুলোও ফেচ করার জন্য include যোগ করা হয়েছে)
export const getProducts = async (req, res) => {
  try {
    const { shopId } = req.user;
    if (!shopId) return res.status(400).json({ message: "Shop assignment missing." });

    const products = await prisma.product.findMany({
      where: { shopId: Number(shopId) },
      include: { 
        category: true,
        packs: true // প্যাক প্রোডাক্টগুলোর কনফিগারেশন দেখার জন্য
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

// ২. Create Product (Standard & Pack Product Support)
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      sku, 
      category, 
      inventoryType, 
      baseUnit, 
      standardData, 
      packs, 
      description, 
      requestShopId 
    } = req.body;

    // শপ আইডি নির্ধারণ
    const finalShopId = validateShopAccess(req.user, requestShopId);
    if (!finalShopId) return res.status(403).json({ message: "Access denied or Invalid Shop ID." });

    // মৌলিক ভ্যালিডেশন
    if (!name || !category) {
      return res.status(400).json({ message: "Product name and category are required." });
    }

    const categoryName = typeof category === 'string' ? category.trim() : category.name;

    // ক্যাটাগরি হ্যান্ডলিং (নির্দিষ্ট শপের আন্ডারে ক্যাটাগরি চেক এবং ক্রিয়েট করা)
    let dbCategory = await prisma.category.findFirst({
      where: {
        name: { equals: categoryName, mode: 'insensitive' },
        shopId: finalShopId 
      }
    });

    if (!dbCategory) {
      dbCategory = await prisma.category.create({
        data: {
          name: categoryName,
          shopId: finalShopId 
        }
      });
    }

    // টাইপ অনুযায়ী প্রাইস এবং স্টক সেট করা
    let purchasePrice = 0;
    let sellingPrice = 0;
    let quantity = 0;

    const type = inventoryType || 'standard';
    const unitVal = baseUnit || 'Pcs';

    if (type === 'standard' && standardData) {
      purchasePrice = parseFloat(standardData.purchasePrice) || 0;
      sellingPrice = parseFloat(standardData.sellingPrice) || 0;
      quantity = parseFloat(standardData.stock) || 0;
    }

    // ট্রানজেকশনের মাধ্যমে প্রোডাক্ট এবং প্যাক (যদি থাকে) একসাথে সেভ করা
    const newProduct = await prisma.$transaction(async (tx) => {
      // প্রোডাক্ট মেইন ডাটা তৈরি
      const product = await tx.product.create({
        data: {
          name,
          sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
          inventoryType: type,
          baseUnit: unitVal,
          quantity,
          unit: unitVal,
          purchasePrice,
          sellingPrice,
          categoryId: dbCategory.id,
          shopId: finalShopId,
          description,
          status: quantity > 0 ? "ACTIVE" : "INACTIVE"
        }
      });

      // যদি প্যাক টাইপ হয় এবং প্যাক লিস্ট থাকে, তবে `product_packs` টেবিলে সেভ হবে
      if (type === 'pack' && packs && Array.isArray(packs) && packs.length > 0) {
        const packDataToInsert = packs.map(pack => ({
          productId: product.id,
          packName: pack.packName,
          multiplier: parseFloat(pack.multiplier) || 1,
          purchasePrice: parseFloat(pack.purchasePrice) || 0,
          sellingPrice: parseFloat(pack.sellingPrice) || 0,
        }));

        await tx.productPack.createMany({
          data: packDataToInsert,
        });
      }

      return product;
    });

    // ফ্রন্টএন্ডে রিলেশনসহ ডাটা রিটার্ন করা
    const createdProductWithRelations = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { category: true, packs: true }
    });

    res.status(201).json(createdProductWithRelations);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Error creating product", error: error.message });
  }
};

// ৩. Delete Product (ProductPack ডাটাও ক্যাস্কেড ডিলিট হয়ে যাবে স্কিমা অনুযায়ী)
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

// ৪. Update Product
export const updateProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    const {
      name,
      sku,
      category,
      quantity,
      unit,
      purchasePrice,
      sellingPrice,
      description,
      status,
      inventoryType,
      baseUnit,
      packs,
      standardData
    } = req.body;

    const { role, shopId } = req.user;

    // Product exists কিনা চেক
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, packs: true },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Security Check
    if (role !== "ADMIN" && existingProduct.shopId !== Number(shopId)) {
      return res.status(403).json({ message: "Unauthorized: Access denied." });
    }

    // Category Handle
    let categoryId = existingProduct.categoryId;

    if (category && category.trim() !== "") {
      let dbCategory = await prisma.category.findFirst({
        where: {
          name: { equals: category.trim(), mode: "insensitive" },
          shopId: existingProduct.shopId
        },
      });

      if (!dbCategory) {
        dbCategory = await prisma.category.create({
          data: {
            name: category.trim(),
            shopId: existingProduct.shopId
          },
        });
      }

      categoryId = dbCategory.id;
    }

    // Product Update with Transaction (প্যাক আপডেট হ্যান্ডেল করার জন্য)
    const updatedProduct = await prisma.$transaction(async (tx) => {
      
      // যদি প্যাক ডেটা পাঠানো হয়, তবে আগের প্যাকগুলো ডিলিট করে নতুন প্যাকগুলো ইনসার্ট করতে পারি অথবা আপডেট করতে পারি
      if (packs && Array.isArray(packs)) {
        await tx.productPack.deleteMany({ where: { productId } });
        
        if (packs.length > 0) {
          const packDataToInsert = packs.map(pack => ({
            productId,
            packName: pack.packName,
            multiplier: parseFloat(pack.multiplier) || 1,
            purchasePrice: parseFloat(pack.purchasePrice) || 0,
            sellingPrice: parseFloat(pack.sellingPrice) || 0,
          }));
          await tx.productPack.createMany({ data: packDataToInsert });
        }
      }

      const finalQuantity = quantity !== undefined ? parseFloat(quantity) : existingProduct.quantity;
      const finalPurchasePrice = standardData?.purchasePrice !== undefined 
        ? parseFloat(standardData.purchasePrice) 
        : (purchasePrice !== undefined ? parseFloat(purchasePrice) : existingProduct.purchasePrice);
        
      const finalSellingPrice = standardData?.sellingPrice !== undefined 
        ? parseFloat(standardData.sellingPrice) 
        : (sellingPrice !== undefined ? parseFloat(sellingPrice) : existingProduct.sellingPrice);

      return await tx.product.update({
        where: { id: productId },
        data: {
          name: name ?? existingProduct.name,
          sku: sku ?? existingProduct.sku,
          inventoryType: inventoryType ?? existingProduct.inventoryType,
          baseUnit: baseUnit ?? existingProduct.baseUnit,
          unit: unit ?? baseUnit ?? existingProduct.unit,
          quantity: finalQuantity,
          purchasePrice: finalPurchasePrice,
          sellingPrice: finalSellingPrice,
          description: description ?? existingProduct.description,
          status: status ?? (finalQuantity > 0 ? "ACTIVE" : "INACTIVE"),
          categoryId,
        },
        include: {
          category: true,
          packs: true,
        },
      });
    });

    res.status(200).json({
      message: "Product updated successfully.",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      message: "Error updating product",
      error: error.message,
    });
  }
};