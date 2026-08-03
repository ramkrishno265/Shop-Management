import prisma from "../config/db.js";

// Utility: শপ আইডি ভ্যালিডেশন
const validateShopAccess = (user, requestShopId) => {
  const userShopId = user.shopId ? Number(user.shopId) : null;
  const targetShopId = requestShopId ? Number(requestShopId) : userShopId;

  if (!targetShopId) return null;

  // ADMIN সব শপ অ্যাক্সেস করতে পারবে, অন্যরা শুধু তাদের নিজস্ব শপ
  if (user.role !== "ADMIN" && targetShopId !== userShopId) {
    return null;
  }
  return targetShopId;
};

// ১. Get Products
export const getProducts = async (req, res) => {
  try {
    const shopId = req.user?.shopId ? Number(req.user.shopId) : null;
    if (!shopId) return res.status(400).json({ message: "Shop assignment missing." });

    const products = await prisma.product.findMany({
      where: { shopId: shopId },
      include: { 
        category: true,
        packs: true 
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

// ২. Create Product (Standard & Pack Product Support)
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      sku, 
      barcode,
      category, 
      inventoryType, 
      baseUnit, 
      standardData, 
      packs, 
      description, 
      requestShopId,
      lowStockLimit
    } = req.body;

    // শপ আইডি নির্ধারণ
    const finalShopId = validateShopAccess(req.user, requestShopId);
    if (!finalShopId) return res.status(403).json({ message: "Access denied or Invalid Shop ID." });

    // মৌলিক ভ্যালিডেশন
    if (!name || !category) {
      return res.status(400).json({ message: "Product name and category are required." });
    }

    // ক্যাটাগরি নাম সুরক্ষিতভাবে বের করা
    let categoryName = '';
    if (typeof category === 'string') {
      categoryName = category.trim();
    } else if (typeof category === 'object' && category !== null) {
      categoryName = (category.name || '').trim();
    }

    if (!categoryName) {
      return res.status(400).json({ message: "Invalid category format." });
    }

    // ক্যাটাগরি হ্যান্ডলিং
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

    // টাইপ অনুযায়ী প্রাইস এবং স্টক সেট করা (Standard Product এর জন্য)
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

    // ফ্রন্টএন্ড থেকে packs অবজেক্ট বা অ্যারে আকারে আসতে পারে, সেফটি চেক
    let parsedPacks = [];
    if (type === 'pack') {
      if (Array.isArray(packs)) {
        parsedPacks = packs;
      } else if (packs && typeof packs === 'object' && Array.isArray(packs.packs)) {
        parsedPacks = packs.packs;
      }
    }

    // ট্রানজেকশনের মাধ্যমে প্রোডাক্ট এবং প্যাক একসাথে সেভ করা
    const newProduct = await prisma.$transaction(async (tx) => {
      // যদি প্যাক টাইপ হয়, তবে টোটাল স্টক বা বেস স্টক প্যাকগুলোর গুণফল থেকেও হিসাব করা যেতে পারে, অথবা স্ট্যান্ডার্ড জিরো রাখা যায়।
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku && sku.trim() !== "" ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
          barcode: barcode ? barcode.trim() : null,
          inventoryType: type,
          baseUnit: unitVal,
          quantity, // স্ট্যান্ডার্ড প্রোডাক্টের স্টক (প্যাকের ক্ষেত্রে এটি ০ বা ক্যালকুলেটেড থাকতে পারে)
          purchasePrice,
          sellingPrice,
          lowStockLimit: lowStockLimit ? parseFloat(lowStockLimit) : 5,
          categoryId: dbCategory.id,
          shopId: finalShopId,
          description: description ? description.trim() : null,
          status: quantity > 0 || type === 'pack' ? "ACTIVE" : "INACTIVE"
        }
      });

      // প্যাক ডাটা এবং প্যাক স্টক ইনসার্ট করা
      if (type === 'pack' && parsedPacks.length > 0) {
        const packDataToInsert = parsedPacks.map(pack => ({
          productId: product.id,
          packName: pack.packName ? pack.packName.trim() : 'Default Pack',
          multiplier: parseFloat(pack.multiplier) || 1,
          stock: parseFloat(pack.stock) || 0, // 👈 প্যাকের নিজস্ব স্টক এখানে যুক্ত করা হয়েছে
          purchasePrice: parseFloat(pack.purchasePrice) || 0,
          sellingPrice: parseFloat(pack.sellingPrice) || 0,
        }));

        await tx.productPack.createMany({
          data: packDataToInsert,
        });
      }

      return product;
    });

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

// ৩. Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { role, shopId } = req.user;
    const userShopId = shopId ? Number(shopId) : null;

    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
    if (!existingProduct) return res.status(404).json({ message: "Product not found." });

    if (role !== "ADMIN" && existingProduct.shopId !== userShopId) {
      return res.status(403).json({ message: "Unauthorized: Access denied." });
    }

    await prisma.product.delete({ where: { id: productId } });
    res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error deleting product:", error);
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
    const userShopId = shopId ? Number(shopId) : null;

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, packs: true },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (role !== "ADMIN" && existingProduct.shopId !== userShopId) {
      return res.status(403).json({ message: "Unauthorized: Access denied." });
    }

    let categoryId = existingProduct.categoryId;

    if (category) {
      let categoryName = '';
      if (typeof category === 'string') {
        categoryName = category.trim();
      } else if (typeof category === 'object' && category !== null) {
        categoryName = (category.name || '').trim();
      }

      if (categoryName !== "") {
        let dbCategory = await prisma.category.findFirst({
          where: {
            name: { equals: categoryName, mode: "insensitive" },
            shopId: existingProduct.shopId
          },
        });

        if (!dbCategory) {
          dbCategory = await prisma.category.create({
            data: {
              name: categoryName,
              shopId: existingProduct.shopId
            },
          });
        }

        categoryId = dbCategory.id;
      }
    }

    // প্যাক পার্সিং সেফটি চেক
    let parsedPacks = null;
    if (packs !== undefined) {
      if (Array.isArray(packs)) {
        parsedPacks = packs;
      } else if (packs && typeof packs === 'object' && Array.isArray(packs.packs)) {
        parsedPacks = packs.packs;
      }
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      if (parsedPacks !== null) {
        await tx.productPack.deleteMany({ where: { productId } });
        
        if (parsedPacks.length > 0) {
          const packDataToInsert = parsedPacks.map(pack => ({
            productId,
            packName: pack.packName ? pack.packName.trim() : 'Default Pack',
            multiplier: parseFloat(pack.multiplier) || 1,
            stock: parseFloat(pack.stock) || 0, // 👈 প্যাকের স্টক আপডেট নিশ্চিত করা হলো
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
          name: name ? name.trim() : existingProduct.name,
          sku: sku ? sku.trim() : existingProduct.sku,
          inventoryType: inventoryType ?? existingProduct.inventoryType,
          baseUnit: baseUnit ?? existingProduct.baseUnit,
          quantity: finalQuantity,
          purchasePrice: finalPurchasePrice,
          sellingPrice: finalSellingPrice,
          description: description !== undefined ? description.trim() : existingProduct.description,
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