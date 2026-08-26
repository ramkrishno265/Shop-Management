import prisma from "../config/db.js";

// Utility: Prisma error-কে ইউজার-ফ্রেন্ডলি বাংলা মেসেজে রূপান্তর
const friendlyFieldName = {
  sku: "SKU (Product Code)",
  barcode: "বারকোড (Barcode)",
  name: "প্রোডাক্টের নাম",
  invoiceNo: "ইনভয়েস নম্বর",
};

const getFriendlyErrorMessage = (error) => {
  // Prisma Unique Constraint Violation (P2002)
  if (error?.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target
      : [error.meta?.target].filter(Boolean);
    const fieldKey = target[0];
    const fieldLabel = friendlyFieldName[fieldKey] || fieldKey || "একটি ফিল্ড";
    return `এই ${fieldLabel} আগে থেকেই অন্য একটি প্রোডাক্টে ব্যবহৃত হয়েছে। দয়া করে একটি ভিন্ন ${fieldLabel} দিন।`;
  }

  // Prisma Foreign Key / Related Record Not Found (P2003, P2025)
  if (error?.code === "P2003" || error?.code === "P2025") {
    return "সম্পর্কিত তথ্য (যেমন ক্যাটাগরি) খুঁজে পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।";
  }

  return null;
};

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
        packs: true,
        inventoryLayers: {
          where: { 
            remainingQty: { gt: 0 },
            shopId: shopId // 👈 এখানে অবশ্যই shopId ফিল্টার দিতে হবে
          },
          orderBy: { createdAt: "asc" }, // সবচেয়ে পুরোনো লেয়ার আগে
          take: 1, // ওই নির্দিষ্ট শপের বর্তমান লেয়ারটি নেবে
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // প্রোডাক্টের মূল purchasePrice কে active layer এর unitCost দিয়ে ওভাররাইট করা
    const formattedProducts = products.map((product) => {
      const activeLayer = product.inventoryLayers?.[0];
      return {
        ...product,
        // এখন এই দামটি শুধুমাত্র ওই শপের FIFO লেয়ার থেকেই আসবে
        purchasePrice: activeLayer ? activeLayer.unitCost : product.purchasePrice,
      };
    });

    res.status(200).json(formattedProducts);
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
      brand,
      category,
      inventoryType,
      baseUnit,
      standardData,
      packs,
      description,
      requestShopId,
      lowStockLimit,
      customFields
    } = req.body;

    const finalShopId = validateShopAccess(req.user, requestShopId);
    if (!finalShopId) return res.status(403).json({ message: "Access denied or Invalid Shop ID." });

    if (!name || !category) {
      return res.status(400).json({ message: "Product name and category are required." });
    }

    let categoryName = '';
    if (typeof category === 'string') {
      categoryName = category.trim();
    } else if (typeof category === 'object' && category !== null) {
      categoryName = (category.name || '').trim();
    }

    if (!categoryName) {
      return res.status(400).json({ message: "Invalid category format." });
    }

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

    let purchasePrice = 0;
    let sellingPrice = 0;
    let quantity = 0;

    const type = inventoryType || 'standard';
    const unitVal = baseUnit || 'Pcs';

    let parsedPacks = [];
    if (type === 'pack') {
      if (Array.isArray(packs)) {
        parsedPacks = packs;
      } else if (packs && typeof packs === 'object' && Array.isArray(packs.packs)) {
        parsedPacks = packs.packs;
      }
    }

    if (type === 'standard' && standardData) {
      purchasePrice = parseFloat(standardData.purchasePrice) || 0;
      sellingPrice = parseFloat(standardData.sellingPrice) || 0;
      quantity = parseFloat(standardData.stock) || 0;
    } else if (type === 'pack' && parsedPacks.length > 0) {
      quantity = parsedPacks.reduce((sum, p) => {
        const packStock = parseFloat(p.stock) || 0;
        const multiplier = parseFloat(p.multiplier) || 1;
        return sum + (packStock * multiplier);
      }, 0);

      purchasePrice = parseFloat(parsedPacks[0].purchasePrice) || 0;
      sellingPrice = parseFloat(parsedPacks[0].sellingPrice) || 0;
    }

    const newProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          sku: sku && sku.trim() !== "" ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
          barcode: barcode ? barcode.trim() : null,
          brand: brand && brand.trim() !== "" ? brand.trim() : null,
          inventoryType: type,
          baseUnit: unitVal,
          quantity,
          purchasePrice,
          sellingPrice,
          lowStockLimit: lowStockLimit ? parseFloat(lowStockLimit) : 5,
          categoryId: dbCategory.id,
          shopId: finalShopId,
          description: description ? description.trim() : null,
          status: quantity > 0 || type === 'pack' ? "ACTIVE" : "INACTIVE",
          customFields: customFields || {}
        }
      });

      if (type === 'pack' && parsedPacks.length > 0) {
        const packDataToInsert = parsedPacks.map(pack => ({
          productId: product.id,
          packName: pack.packName ? pack.packName.trim() : 'Default Pack',
          multiplier: parseFloat(pack.multiplier) || 1,
          stock: parseFloat(pack.stock) || 0,
          purchasePrice: parseFloat(pack.purchasePrice) || 0,
          sellingPrice: parseFloat(pack.sellingPrice) || 0,
        }));

        await tx.productPack.createMany({
          data: packDataToInsert,
        });
      }

      // InventoryLayer এ সঠিক ডেটা ইনসার্ট করা (shopId সহ)
      if (quantity > 0) {
        if (type === 'standard') {
          await tx.inventoryLayer.create({
            data: {
              shopId: finalShopId, // 👈 স্কিমা অনুযায়ী শপ আইডি যুক্ত করা হলো
              productId: product.id,
              initialQty: quantity,
              remainingQty: quantity,
              unitCost: purchasePrice
            }
          });
        } else if (type === 'pack') {
          for (const pack of parsedPacks) {
            const packStock = parseFloat(pack.stock) || 0;
            const multiplier = parseFloat(pack.multiplier) || 1;
            const totalBaseUnits = packStock * multiplier;
            const packPurchasePrice = parseFloat(pack.purchasePrice) || 0;
            const unitCostPerBase = multiplier > 0 ? (packPurchasePrice / multiplier) : packPurchasePrice;

            if (totalBaseUnits > 0) {
              await tx.inventoryLayer.create({
                data: {
                  shopId: finalShopId, // 👈 স্কিমা অনুযায়ী শপ আইডি যুক্ত করা হলো
                  productId: product.id,
                  initialQty: totalBaseUnits,
                  remainingQty: totalBaseUnits,
                  unitCost: unitCostPerBase
                }
              });
            }
          }
        }
      }

      return product;
    });

    const createdProductWithRelations = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { category: true, packs: true, inventoryLayers: true }
    });

    res.status(201).json(createdProductWithRelations);
  } catch (error) {
    console.error("Error creating product:", error);
    const friendlyMessage = getFriendlyErrorMessage(error);
    if (friendlyMessage) {
      return res.status(409).json({ message: friendlyMessage });
    }
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
      brand,
      category,
      quantity,
      purchasePrice,
      sellingPrice,
      description,
      status,
      inventoryType,
      baseUnit,
      packs,
      standardData,
      customFields
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
      let finalQuantity = quantity !== undefined ? parseFloat(quantity) : existingProduct.quantity;
      const currentInventoryType = inventoryType ?? existingProduct.inventoryType;

      if (parsedPacks !== null) {
        await tx.productPack.deleteMany({ where: { productId } });

        if (parsedPacks.length > 0) {
          const packDataToInsert = parsedPacks.map(pack => ({
            productId,
            packName: pack.packName ? pack.packName.trim() : 'Default Pack',
            multiplier: parseFloat(pack.multiplier) || 1,
            stock: parseFloat(pack.stock) || 0,
            purchasePrice: parseFloat(pack.purchasePrice) || 0,
            sellingPrice: parseFloat(pack.sellingPrice) || 0,
          }));
          await tx.productPack.createMany({ data: packDataToInsert });

          // যদি আপডেট করার সময় প্যাক থাকে, তবে নতুন প্যাকগুলোর স্টক থেকে টোটাল `quantity` রি-ক্যালকুলেট করে নেওয়া ভালো
          if (currentInventoryType === 'pack') {
            finalQuantity = parsedPacks.reduce((sum, p) => {
              const packStock = parseFloat(p.stock) || 0;
              const multiplier = parseFloat(p.multiplier) || 1;
              return sum + (packStock * multiplier);
            }, 0);
          }
        }
      }

      // যদি স্ট্যান্ডার্ড ডাটা থাকে
      if (currentInventoryType === 'standard' && standardData) {
        finalQuantity = standardData.stock !== undefined ? parseFloat(standardData.stock) : finalQuantity;
      }

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
          brand: brand !== undefined ? (brand.trim() !== "" ? brand.trim() : null) : existingProduct.brand,
          inventoryType: currentInventoryType,
          baseUnit: baseUnit ?? existingProduct.baseUnit,
          quantity: finalQuantity, // 👈 সঠিক ক্যালকুলেটেড স্টক আপডেট হবে
          purchasePrice: finalPurchasePrice,
          sellingPrice: finalSellingPrice,
          description: description !== undefined ? description.trim() : existingProduct.description,
          status: status ?? (finalQuantity > 0 ? "ACTIVE" : "INACTIVE"),
          categoryId,
          customFields: customFields !== undefined ? customFields : existingProduct.customFields,
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
    const friendlyMessage = getFriendlyErrorMessage(error);
    if (friendlyMessage) {
      return res.status(409).json({ message: friendlyMessage });
    }
    res.status(500).json({
      message: "Error updating product",
      error: error.message,
    });
  }
};

// ৫. Get Product By ID (For Editing)
export const getProductById = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { role, shopId } = req.user;
    const userShopId = shopId ? Number(shopId) : null;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, packs: true }
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (role !== "ADMIN" && product.shopId !== userShopId) {
      return res.status(403).json({ message: "Unauthorized: Access denied." });
    }

    res.status(200).json({ product });
  } catch (error) {
    console.error("Error fetching product by id:", error);
    res.status(500).json({ message: "Error fetching product", error: error.message });
  }
};

// ৬. AI Voice / Text Product Parser (Updated)
export const parseProductWithAI = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: "কোনো টেক্সট পাওয়া যায়নি!" });
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // আপনার productController.js ফাইলের ভেতরে এই অংশটি এভাবে আপডেট করুন:
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      You are a Product Entry Assistant for a shop inventory management system. 
      Understand the given Bangla or English text and extract product information accurately.
      If the user specifies a pack, bag, or multi-unit item (e.g., "২৫ কেজি বস্তা", "10 kg bag", "৫ লিটার জার"), categorize it as inventoryType "pack". Otherwise, use "standard".
      
      Return ONLY a valid JSON object matching this exact structure, with no markdown code blocks (like \`\`\`json) and no extra text:
      {
        "action": "add_product",
        "name": "string (product name, e.g., মিনিকেট চাল)",
        "category": "string or null (e.g., চাল, তেল, মসলা - if not mentioned, guess a relevant category or null)",
        "inventoryType": "standard" or "pack",
        "baseUnit": "Kg" | "Gram" | "Mon" | "Pcs" | "Pair" | "Dozen" | "Liter" | "Ml" | "Packet" | "Box" | "Bottle",
        "standardData": {
          "purchasePrice": number or 0,
          "sellingPrice": number or 0,
          "stock": number or 0
        },
        "packs": [
          {
            "packName": "string (e.g., ২৫ কেজি বস্তা)",
            "multiplier": number (e.g., 25),
            "stock": number (e.g., quantity of packs, like 10),
            "purchasePrice": number or 0,
            "sellingPrice": number or 0
          }
        ]
      }

      Input text: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    console.log("Raw AI Response:", responseText);

    const cleanedJsonString = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedJsonString);

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("AI Parsing Error:", error);
    return res.status(500).json({
      success: false,
      message: "AI প্রসেসিংয়ে সমস্যা হয়েছে",
      error: error.message
    });
  }
};

// ৭. Bulk Import Products (Standard & Pack Support with Multi-Shop Validation)
export const bulkImportProducts = async (req, res) => {
  try {
    const { products, requestShopId } = req.body;

    // ১. শপ এক্সেস ভ্যালিডেশন
    const finalShopId = validateShopAccess(req.user, requestShopId);
    if (!finalShopId) {
      return res.status(403).json({ message: "Access denied or Invalid Shop ID." });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Invalid data format or empty products list." });
    }

    let successCount = 0;
    let failedProducts = [];

    // প্রতিটা প্রোডাক্ট লুপ চালিয়ে প্রসেস করা
    for (const item of products) {
      try {
        if (!item.name) {
          failedProducts.push({ item, reason: "Product name is missing." });
          continue;
        }

        const productName = String(item.name).trim();
        const inventoryType = item.inventoryType === 'pack' ? 'pack' : 'standard';
        const baseUnit = item.baseUnit ? String(item.baseUnit).trim() : 'Pcs';
        const brandValue = item.brand && String(item.brand).trim() !== "" ? String(item.brand).trim() : null;

        // ২. ক্যাটাগরি হ্যান্ডলিং (নাম দিয়ে খুঁজে বা তৈরি করে নেওয়া)
        let categoryId = null;
        if (item.category) {
          const categoryName = typeof item.category === 'string' ? item.category.trim() : (item.category.name || '').trim();

          if (categoryName) {
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
            categoryId = dbCategory.id;
          }
        }

        // ৩. SKU এবং Barcode ইউনিক চেক ও ডুপ্লিকেট এড়ানোর লজিক
        let baseSku = item.sku !== undefined && item.sku !== null && String(item.sku).trim() !== ""
          ? String(item.sku).trim()
          : `SKU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        let skuValue = baseSku;
        let counter = 1;
        
        // ডাটাবেজে SKU অলরেডি থাকলে ইউনিক করার জন্য লুপ চালানো
        while (true) {
          const existingSku = await prisma.product.findFirst({
            where: { sku: skuValue, shopId: finalShopId }
          });
          if (!existingSku) break;
          skuValue = `${baseSku}-${counter}`;
          counter++;
        }

        // বারকোড হ্যান্ডলিং (ফাঁকা হলে null এবং ডুপ্লিকেট হলে ইউনিক করা)
        let barcodeValue = null;
        if (item.barcode !== undefined && item.barcode !== null && String(item.barcode).trim() !== "") {
          const rawBarcode = String(item.barcode).trim();
          const existingBarcode = await prisma.product.findFirst({
            where: { barcode: rawBarcode, shopId: finalShopId }
          });

          if (!existingBarcode) {
            barcodeValue = rawBarcode;
          } else {
            barcodeValue = `${rawBarcode}-${Math.floor(Math.random() * 1000)}`;
          }
        }

        let quantity = 0;
        let purchasePrice = parseFloat(item.purchasePrice) || 0;
        let sellingPrice = parseFloat(item.sellingPrice) || 0;
        let parsedPacks = [];

        // প্যাক হ্যান্ডলিং
        if (inventoryType === 'pack' && item.packs && Array.isArray(item.packs)) {
          parsedPacks = item.packs;
          quantity = parsedPacks.reduce((sum, p) => {
            const packStock = parseFloat(p.stock) || 0;
            const multiplier = parseFloat(p.multiplier) || 1;
            return sum + (packStock * multiplier);
          }, 0);

          if (parsedPacks.length > 0) {
            purchasePrice = parseFloat(parsedPacks[0].purchasePrice) || purchasePrice;
            sellingPrice = parseFloat(parsedPacks[0].sellingPrice) || sellingPrice;
          }
        } else {
          quantity = parseFloat(item.quantity) || 0;
        }

        // ৪. ট্রানজেকশনের মাধ্যমে প্রোডাক্ট এবং প্যাক সেভ করা
        await prisma.$transaction(async (tx) => {
          const newProduct = await tx.product.create({
            data: {
              name: productName,
              sku: skuValue,
              barcode: barcodeValue,
              brand: brandValue,
              inventoryType: inventoryType,
              baseUnit: baseUnit,
              quantity: quantity,
              purchasePrice: purchasePrice,
              sellingPrice: sellingPrice,
              lowStockLimit: item.lowStockLimit ? parseFloat(item.lowStockLimit) : 5,
              categoryId: categoryId,
              shopId: finalShopId,
              description: item.description ? String(item.description).trim() : null,
              status: quantity > 0 || inventoryType === 'pack' ? "ACTIVE" : "INACTIVE",
              customFields: item.customFields || {}
            }
          });

          // যদি প্যাক প্রোডাক্ট হয়, তবে `product_packs` টেবিলে ডাটা ইনসার্ট করা
          if (inventoryType === 'pack' && parsedPacks.length > 0) {
            const packDataToInsert = parsedPacks.map(pack => ({
              productId: newProduct.id,
              packName: pack.packName ? String(pack.packName).trim() : 'Default Pack',
              multiplier: parseFloat(pack.multiplier) || 1,
              stock: parseFloat(pack.stock) || 0,
              purchasePrice: parseFloat(pack.purchasePrice) || 0,
              sellingPrice: parseFloat(pack.sellingPrice) || 0,
            }));

            await tx.productPack.createMany({
              data: packDataToInsert,
            });
          }
        });

        successCount++;
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        failedProducts.push({ item: item.name, reason: friendlyMessage || err.message });
      }
    }

    return res.status(200).json({
      message: "Bulk import process completed.",
      totalAttempted: products.length,
      successCount,
      failedCount: failedProducts.length,
      failedProducts
    });

  } catch (error) {
    console.error("Bulk Import Error:", error);
    return res.status(500).json({ message: "Error during bulk import", error: error.message });
  }
};