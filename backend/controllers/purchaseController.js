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

// ✅ ফিক্স: স্কিমায় Supplier মডেলে `company`/`email` ফিল্ড নেই — আগে এগুলো পাঠানো হলে
// Prisma validation error দিয়ে request পুরোপুরি fail করত (supplier edit কার্যত ভাঙা ছিল)।
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, note } = req.body;

    const updatedSupplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: { name, phone, address, note },
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
// PURCHASE CONTROLLERS (FIFO Layer Integrated, Pack-Aware)
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
        inventoryLayers: true,
        pack: true, // 👈 pack info দেখানোর জন্য (কোন প্যাক দিয়ে কেনা হয়েছিল)
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * একটি প্রোডাক্ট/প্যাক-এর জন্য এন্ট্রি করা (quantity, unit_price)-কে
 * সবসময় base-unit ভিত্তিক (baseQty, unitCostPerBase) এ কনভার্ট করে।
 *
 * - standard প্রোডাক্ট: quantity = base unit সংখ্যা, unit_price = per-base-unit দাম। কনভার্সনের দরকার নেই।
 * - pack প্রোডাক্ট + packId দেওয়া হয়েছে: quantity = কয়টা প্যাক কেনা হয়েছে,
 *   unit_price = প্রতি প্যাকের দাম। multiplier দিয়ে ভাগ/গুণ করে base unit-এ আনা হয়।
 */
const resolvePurchaseConversion = ({ product, pack, enteredQuantity, enteredUnitPrice }) => {
  if (product.inventoryType === 'pack' && pack) {
    const multiplier = Number(pack.multiplier) || 1;
    return {
      baseQty: enteredQuantity * multiplier,
      unitCostPerBase: multiplier > 0 ? enteredUnitPrice / multiplier : enteredUnitPrice,
      packCount: enteredQuantity, // ProductPack.stock আপডেটের জন্য
    };
  }
  // standard প্রোডাক্ট, বা pack টাইপ কিন্তু packId দেওয়া হয়নি (তখনও raw ভ্যালুই base ধরা হয়,
  // যাতে অন্তত পুরনো raw-quantity ফ্লো ভাঙে না — কিন্তু ফ্রন্টএন্ডে packId পাঠানো বাধ্যতামূলক করা উচিত)
  return {
    baseQty: enteredQuantity,
    unitCostPerBase: enteredUnitPrice,
    packCount: 0,
  };
};

// ২. নতুন পারচেজ সেভ করা (FIFO Inventory Layer + Pack-aware)
// ২. নতুন পারচেজ সেভ করা (FIFO Inventory Layer + Pack-aware, Multi-item Supported)
export const createPurchase = async (req, res) => {
  try {
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      items, // 👈 ফ্রন্টএন্ড থেকে পাঠানো items অ্যারে
      total_amount,
      paid_amount,
      due_amount,
      note,
      createdBy = req.user?.id || 1
    } = req.body;

    const numericShopId = Number(shopId);
    if (!numericShopId || !supplier_id) {
      return res.status(400).json({ success: false, message: "Shop ID and Supplier are required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one purchase item is required" });
    }

    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`;

    const newPurchase = await prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const purchaseItemsData = [];
      const inventoryLayersData = [];
      const productUpdates = [];
      const stockLogsData = [];
      const packUpdates = [];

      for (const item of items) {
        let targetProductId = Number(item.productId);
        const enteredQuantity = Number(item.quantity) || 0;
        const enteredUnitPrice = Number(item.unit_price) || 0;
        const itemTotal = enteredQuantity * enteredUnitPrice;
        calculatedTotal += itemTotal;

        if (!targetProductId && item.product) {
          const foundProd = await tx.product.findFirst({
            where: { shopId: numericShopId, name: item.product }
          });
          if (foundProd) targetProductId = foundProd.id;
        }

        const productRecord = await tx.product.findUnique({ where: { id: targetProductId } });
        if (!productRecord) {
          throw new Error(`প্রোডাক্ট (${item.product || targetProductId}) খুঁজে পাওয়া যায়নি!`);
        }

        let packRecord = null;
        if (item.packId) {
          packRecord = await tx.productPack.findUnique({ where: { id: Number(item.packId) } });
          if (!packRecord || packRecord.productId !== productRecord.id) {
            throw new Error(`নির্বাচিত প্যাকটি ${productRecord.name} প্রোডাক্টের সাথে মিলছে না!`);
          }
        }

        if (productRecord.inventoryType === 'pack' && !packRecord) {
          throw new Error(`${productRecord.name} একটি Pack প্রোডাক্ট — কোন প্যাক দিয়ে কেনা হয়েছে তা নির্বাচন করা আবশ্যক!`);
        }

        const { baseQty, unitCostPerBase, packCount } = resolvePurchaseConversion({
          product: productRecord,
          pack: packRecord,
          enteredQuantity,
          enteredUnitPrice,
        });

        purchaseItemsData.push({
          productId: targetProductId,
          productName: item.product || productRecord.name,
          quantity: enteredQuantity,
          unitPrice: enteredUnitPrice,
          totalPrice: itemTotal,
        });

        // সাময়িক পারচেজ অবজেক্টের জন্য বেস ইউনিট কোয়ান্টিটি হিসাব রাখা
        // (নিচে purchase তৈরির সময় মূল data-তে এটি হ্যান্ডেল করা হবে)
        item._baseQty = baseQty;
        item._unitCostPerBase = unitCostPerBase;
        item._packCount = packCount;
        item._productRecord = productRecord;
        item._packRecord = packRecord;
      }

      // মূল Purchase রেকর্ড তৈরি
      const purchase = await tx.purchase.create({
        data: {
          invoiceNo,
          shopId: numericShopId,
          supplier_id: Number(supplier_id),
          date: date || new Date().toISOString().split('T')[0],
          payment_status: payment_status || "Paid",
          product: items.length === 1 ? (items[0].product || items[0].productName) : "Multiple Items",
          quantity: items.reduce((acc, curr) => acc + Number(curr.quantity), 0),
          unit_price: items.length === 1 ? Number(items[0].unit_price) : 0,
          total_amount: Number(total_amount) || calculatedTotal,
          paid_amount: Number(paid_amount) || 0,
          due_amount: Number(due_amount) || 0,
          note: note || "",
          createdBy: Number(createdBy),
          packId: items.length === 1 && items[0].packId ? Number(items[0].packId) : null,
          baseUnitQuantity: items.reduce((acc, curr) => acc + curr._baseQty, 0),

          purchaseItems: {
            create: purchaseItemsData
          }
        },
        include: {
          supplier: true,
          purchaseItems: true,
          pack: true,
        }
      });

      // প্রতিটা আইটেমের জন্য ইনভেন্টরি লেয়ার, স্টক এবং লগ আপডেট
      for (const item of items) {
        await tx.inventoryLayer.create({
          data: {
            shopId: numericShopId,
            productId: item._productRecord.id,
            purchaseId: purchase.id,
            initialQty: item._baseQty,
            remainingQty: item._baseQty,
            unitCost: item._unitCostPerBase,
          }
        });

        const previousStock = Number(item._productRecord.quantity) || 0;
        const newStock = previousStock + item._baseQty;

        await tx.product.update({
          where: { id: item._productRecord.id },
          data: {
            quantity: { increment: item._baseQty },
            purchasePrice: item._unitCostPerBase,
          },
        });

        if (item._packRecord) {
          await tx.productPack.update({
            where: { id: item._packRecord.id },
            data: { stock: { increment: item._packCount } },
          });
        }

        await tx.stockLog.create({
          data: {
            productId: item._productRecord.id,
            userId: Number(createdBy),
            changeType: "PURCHASE",
            quantityChanged: item._baseQty,
            previousStock: previousStock,
            newStock: newStock,
            note: `Purchase Invoice: ${invoiceNo}${item._packRecord ? ` (Pack: ${item._packRecord.packName} x${item._packCount})` : ''}`,
          },
        });
      }

      return purchase;
    }, {
      maxWait: 15000,
      timeout: 15000
    });

    res.status(201).json({ success: true, message: 'Purchase saved and FIFO inventory layer created successfully', data: newPurchase });
  } catch (err) {
    console.error("Create Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ৩. পারচেজ আপডেট করা (PUT) — pack-aware, একই transaction-এ atomic
export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shopId,
      supplier_id,
      date,
      payment_status,
      product,
      packId,
      quantity,
      unit_price,
      total_amount,
      paid_amount,
      due_amount,
      note,
    } = req.body;

    const purchaseId = Number(id);

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const existingPurchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { purchaseItems: true, pack: true }
      });

      if (!existingPurchase) {
        throw new Error("Purchase record not found");
      }

      const firstItem = existingPurchase.purchaseItems[0];
      if (!firstItem || !firstItem.productId) {
        throw new Error("এই পারচেজের সাথে কোনো প্রোডাক্ট লিংক করা নেই, আপডেট করা সম্ভব নয়।");
      }

      const productRecord = await tx.product.findUnique({ where: { id: firstItem.productId } });
      if (!productRecord) {
        throw new Error("সংশ্লিষ্ট প্রোডাক্ট খুঁজে পাওয়া যায়নি!");
      }

      const newPackId = packId !== undefined ? (packId ? Number(packId) : null) : existingPurchase.packId;
      let packRecord = null;
      if (newPackId) {
        packRecord = await tx.productPack.findUnique({ where: { id: newPackId } });
        if (!packRecord || packRecord.productId !== productRecord.id) {
          throw new Error("নির্বাচিত প্যাকটি এই প্রোডাক্টের সাথে মিলছে না!");
        }
      }

      if (productRecord.inventoryType === 'pack' && !packRecord) {
        throw new Error("এটি একটি Pack প্রোডাক্ট — কোন প্যাক দিয়ে কেনা হয়েছে তা নির্বাচন করা আবশ্যক!");
      }

      const enteredQuantity = quantity !== undefined ? Number(quantity) : Number(existingPurchase.quantity);
      const enteredUnitPrice = unit_price !== undefined ? Number(unit_price) : Number(existingPurchase.unit_price);
      const parsedTotalAmount = total_amount !== undefined ? Number(total_amount) : Number(existingPurchase.total_amount);

      const { baseQty: newBaseQty, unitCostPerBase, packCount: newPackCount } = resolvePurchaseConversion({
        product: productRecord,
        pack: packRecord,
        enteredQuantity,
        enteredUnitPrice,
      });

      const oldBaseQty = Number(existingPurchase.baseUnitQuantity) || 0;
      const baseQtyDifference = newBaseQty - oldBaseQty;

      // পারচেজ রেকর্ড আপডেট
      const updated = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          supplier_id: Number(supplier_id ?? existingPurchase.supplier_id),
          date: date || existingPurchase.date,
          payment_status: payment_status || existingPurchase.payment_status,
          product: product || existingPurchase.product,
          quantity: enteredQuantity,
          unit_price: enteredUnitPrice,
          total_amount: parsedTotalAmount,
          paid_amount: paid_amount !== undefined ? Number(paid_amount) : existingPurchase.paid_amount,
          due_amount: due_amount !== undefined ? Number(due_amount) : existingPurchase.due_amount,
          note: note !== undefined ? note : existingPurchase.note,
          packId: newPackId,
          baseUnitQuantity: newBaseQty,
        },
        include: { supplier: true, purchaseItems: true, pack: true },
      });

      // সংশ্লিষ্ট ইনভেন্টরি লেয়ার আপডেট (base-unit ভিত্তিক)
      const targetLayer = await tx.inventoryLayer.findFirst({
        where: { purchaseId: purchaseId }
      });

      if (targetLayer) {
        const consumedQty = Number(targetLayer.initialQty) - Number(targetLayer.remainingQty);
        if (consumedQty > newBaseQty) {
          throw new Error(
            `এই পারচেজ থেকে ইতিমধ্যে ${consumedQty} ইউনিট বিক্রি হয়ে গেছে, যা নতুন quantity (${newBaseQty}) থেকে কম করা যাবে না।`
          );
        }
        const newRemainingQty = newBaseQty - consumedQty;

        await tx.inventoryLayer.update({
          where: { id: targetLayer.id },
          data: {
            initialQty: newBaseQty,
            remainingQty: newRemainingQty,
            unitCost: unitCostPerBase,
          }
        });
      }

      // Product স্টক atomic adjust (base-unit ডিফারেন্স দিয়ে, raw quantity দিয়ে না)
      const previousStock = Number(productRecord.quantity) || 0;
      const newStock = Math.max(0, previousStock + baseQtyDifference);

      await tx.product.update({
        where: { id: productRecord.id },
        data: {
          quantity: { increment: baseQtyDifference },
          purchasePrice: unitCostPerBase > 0 ? unitCostPerBase : productRecord.purchasePrice,
        },
      });

      // পুরনো ও নতুন প্যাক আলাদা হলে দুই জায়গার stock ঠিক করা; একই হলে diff apply করা
      const oldPackId = existingPurchase.packId;
      const oldPackCount = Number(existingPurchase.quantity) || 0;

      if (oldPackId && oldPackId !== newPackId) {
        await tx.productPack.update({
          where: { id: oldPackId },
          data: { stock: { decrement: oldPackCount } },
        });
      }
      if (packRecord) {
        const packCountDiff = oldPackId === newPackId ? (newPackCount - oldPackCount) : newPackCount;
        await tx.productPack.update({
          where: { id: packRecord.id },
          data: { stock: { increment: packCountDiff } },
        });
      }

      await tx.stockLog.create({
        data: {
          productId: productRecord.id,
          userId: req.user?.id || existingPurchase.createdBy,
          changeType: "ADJUST",
          quantityChanged: baseQtyDifference,
          previousStock,
          newStock,
          note: `Purchase Updated: ${existingPurchase.invoiceNo}`,
        },
      });

      return updated;
    }, {
      maxWait: 15000,
      timeout: 15000
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

// ৪. পারচেজ ডিলিট করা (DELETE) — এখন স্টক ও pack-stock reverse করে,
// এবং লেয়ার থেকে ইতিমধ্যে বিক্রি হয়ে যাওয়া অংশ থাকলে ডিলিট আটকায় (data-integrity সেফটি)
export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseId = Number(id);

    await prisma.$transaction(async (tx) => {
      const existingPurchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { purchaseItems: true },
      });

      if (!existingPurchase) {
        throw new Error("Purchase record not found");
      }

      const layer = await tx.inventoryLayer.findFirst({ where: { purchaseId } });

      // ✅ আগে delete শুধু purchase রো মুছত — product.quantity, pack.stock, বা
      // InventoryLayer কিছুই reverse হতো না, ফলে ডিলিটের পরও স্টক বাড়তি থেকে যেত।
      if (layer) {
        const consumedQty = Number(layer.initialQty) - Number(layer.remainingQty);
        if (consumedQty > 0) {
          // এই লেয়ার থেকে ইতিমধ্যে কিছু বিক্রি হয়ে গেছে — সেই sale-এর cost এই লেয়ারের
          // উপর নির্ভরশীল, তাই layer/purchase মুছে ফেললে ঐ পুরনো sale-এর cost history
          // ভেঙে যাবে। নিরাপদ না হওয়া পর্যন্ত ডিলিট block করা হলো।
          throw new Error(
            `এই পারচেজ থেকে ${consumedQty} ইউনিট ইতিমধ্যে বিক্রি হয়ে গেছে, তাই এটি ডিলিট করা যাবে না। (রিভার্স করতে হলে আগে সংশ্লিষ্ট sale বাতিল করুন)`
          );
        }

        const productRecord = await tx.product.findUnique({ where: { id: layer.productId } });
        if (productRecord) {
          const previousStock = Number(productRecord.quantity) || 0;
          const newStock = Math.max(0, previousStock - Number(layer.initialQty));

          await tx.product.update({
            where: { id: productRecord.id },
            data: { quantity: { decrement: Number(layer.initialQty) } },
          });

          await tx.stockLog.create({
            data: {
              productId: productRecord.id,
              userId: req.user?.id || null,
              changeType: "ADJUST",
              quantityChanged: -Number(layer.initialQty),
              previousStock,
              newStock,
              note: `Purchase Deleted: ${existingPurchase.invoiceNo}`,
            },
          });
        }

        if (existingPurchase.packId) {
          await tx.productPack.update({
            where: { id: existingPurchase.packId },
            data: { stock: { decrement: Number(existingPurchase.quantity) || 0 } },
          });
        }

        await tx.inventoryLayer.delete({ where: { id: layer.id } });
      }

      await tx.purchase.delete({ where: { id: purchaseId } });
    });

    res.status(200).json({ success: true, message: 'Purchase deleted successfully' });
  } catch (err) {
    console.error("Delete Purchase Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};