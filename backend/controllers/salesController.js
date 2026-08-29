import prisma from "../config/db.js";

const generateInvoiceNo = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `INV-${timestamp}-${randomNum}`;
};

export const createSale = async (req, res) => {
    try {
        const {
            shopId,
            customerId,
            customerName,
            items,
            subTotal,
            discount,
            discountType,
            discountValue,
            discountAmount,
            vatPercentage,
            vatAmount,
            payableAmount,
            receivedAmount,
            changeAmount,
            paymentMethod,
            paymentStatus,
            notes
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "❌ কার্ট সম্পূর্ণ খালি!" });
        }

        if (!shopId) {
            return res.status(400).json({ success: false, message: "❌ শপ আইডি পাওয়া যায়নি!" });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "❌ অথেন্টিকেশন এরর: ইউজার আইডি পাওয়া যায়নি!" });
        }

        const subTotalVal = Number(subTotal) || 0;
        const totalDiscount = Number(discountAmount) !== undefined && discountAmount !== '' ? Number(discountAmount) : (Number(discount) || 0);
        const grandTotalVal = Number(payableAmount) || (subTotalVal - totalDiscount);
        const paidAmountVal = Number(receivedAmount) || 0;

        let dueAmountVal = grandTotalVal - paidAmountVal;
        if (dueAmountVal < 0) dueAmountVal = 0;

        let finalPaymentStatus = paymentStatus;
        if (!finalPaymentStatus) {
            if (paidAmountVal >= grandTotalVal) finalPaymentStatus = "PAID";
            else if (paidAmountVal > 0) finalPaymentStatus = "PARTIAL";
            else finalPaymentStatus = "DUE";
        }

        const result = await prisma.$transaction(async (tx) => {
            // ১. স্টক চেক করার জন্য একসাথে প্রোডাক্ট ফেচ করা
            const productIds = items.map(item => Number(item.productId || item.id));
            const products = await tx.product.findMany({
                where: { id: { in: productIds } }
            });
            const productMap = new Map(products.map(p => [p.id, p]));

            // ✅ একই productId একাধিক cart row-তে (একাধিক pack হিসেবে) থাকতে পারে,
            // তাই স্টক চেক করার সময় সব row-এর deduction একসাথে যোগ করে দেখা হচ্ছে —
            // নাহলে প্রতিটা row আলাদাভাবে চেক করলে মোট চাহিদা স্টকের চেয়ে বেশি হয়ে গেলেও ধরা পড়বে না।
            const totalNeededByProduct = new Map();
            for (let item of items) {
                const prodId = Number(item.productId || item.id);
                const cartQty = Number(item.quantity) || 1;
                const multiplier = Number(item.multiplier || item.packInfo?.multiplier || 1);
                const totalDeductQty = cartQty * multiplier;

                totalNeededByProduct.set(
                    prodId,
                    (totalNeededByProduct.get(prodId) || 0) + totalDeductQty
                );
            }

            for (const [prodId, neededQty] of totalNeededByProduct.entries()) {
                const productRecord = productMap.get(prodId);
                if (!productRecord) {
                    throw new Error(`প্রোডাক্ট আইডি ${prodId} পাওয়া যায়নি!`);
                }
                if (Number(productRecord.quantity || 0) < neededQty) {
                    throw new Error(`"${productRecord.name}" পণ্যের পর্যাপ্ত স্টক নেই! বর্তমান স্টক: ${productRecord.quantity}, প্রয়োজন: ${neededQty}`);
                }
            }

            // ✅ প্যাক-লেভেল স্টকও একইভাবে row-ভিত্তিক না ধরে, প্যাক আইডি অনুযায়ী যোগ করে চেক করা হচ্ছে
            const totalNeededByPack = new Map();
            for (let item of items) {
                const packId = item.packInfo?.id || item.packId;
                if (!packId) continue;
                const cartQty = Number(item.quantity) || 1;
                totalNeededByPack.set(
                    Number(packId),
                    (totalNeededByPack.get(Number(packId)) || 0) + cartQty
                );
            }
            if (totalNeededByPack.size > 0) {
                const packRecords = await tx.productPack.findMany({
                    where: { id: { in: Array.from(totalNeededByPack.keys()) } }
                });
                const packMap = new Map(packRecords.map(p => [p.id, p]));
                for (const [packId, neededQty] of totalNeededByPack.entries()) {
                    const packRecord = packMap.get(packId);
                    if (packRecord && Number(packRecord.stock || 0) < neededQty) {
                        throw new Error(`"${packRecord.packName || packRecord.name}" প্যাকের পর্যাপ্ত স্টক নেই! বর্তমান স্টক: ${packRecord.stock}, প্রয়োজন: ${neededQty}`);
                    }
                }
            }

            // ২. সেলস রেকর্ড তৈরি করা
            const newSale = await tx.sale.create({
                data: {
                    invoiceNo: generateInvoiceNo(),
                    shopId: Number(shopId),
                    customerId: customerId ? Number(customerId) : null,
                    createdBy: Number(userId),
                    subtotal: subTotalVal,
                    discountType: discountType || 'FIXED',
                    discountValue: Number(discountValue) || totalDiscount,
                    discountAmount: totalDiscount,
                    vatPercentage: Number(vatPercentage) || 0,
                    vatAmount: Number(vatAmount) || 0,
                    grandTotal: grandTotalVal,
                    paidAmount: paidAmountVal,
                    dueAmount: dueAmountVal,
                    changeAmount: Number(changeAmount) || 0,
                    paymentMethod: paymentMethod || "CASH",
                    paymentStatus: finalPaymentStatus,
                    notes: notes || (customerName ? `Customer: ${customerName}` : null),
                }
            });

            const saleItemsData = [];

            // ৩. FIFO লজিক ও স্টক আপডেট
            for (let item of items) {
                const prodId = Number(item.productId || item.id);
                const cartQty = Number(item.quantity) || 1;
                const multiplier = Number(item.multiplier || item.packInfo?.multiplier || 1);
                const totalDeductQty = cartQty * multiplier;

                const sellingPrice = Number(item.price) || 0;
                const itemDiscount = Number(item.discount) || 0;
                const itemSubtotal = (sellingPrice * cartQty) - itemDiscount;

                const activeLayers = await tx.inventoryLayer.findMany({
                    where: {
                        productId: prodId,
                        remainingQty: { gt: 0 }
                    },
                    orderBy: { createdAt: 'asc' }
                });

                let qtyNeeded = totalDeductQty;
                let itemTotalCost = 0;
                const layerDeductionsToCreate = [];

                for (const layer of activeLayers) {
                    if (qtyNeeded <= 0) break;

                    const availableInLayer = Number(layer.remainingQty);
                    const takeQty = Math.min(qtyNeeded, availableInLayer);

                    await tx.inventoryLayer.update({
                        where: { id: layer.id },
                        data: {
                            remainingQty: availableInLayer - takeQty
                        }
                    });

                    layerDeductionsToCreate.push({
                        inventoryLayerId: layer.id,
                        quantityTaken: takeQty,
                        unitCost: layer.unitCost
                    });

                    itemTotalCost += (takeQty * Number(layer.unitCost));
                    qtyNeeded -= takeQty;
                }

                if (qtyNeeded > 0) {
                    // ✅ মূল বাগ এখানে ছিল: item.purchasePrice pack-item এর ক্ষেত্রে
                    // "পুরো প্যাকের ক্রয়মূল্য" (যেমন ৩০ ইউনিটের প্যাক কেনা হয়েছে ৳৩০০ দিয়ে)।
                    // কিন্তু qtyNeeded থাকে individual UNIT সংখ্যায় (যেমন ৩০)।
                    // আগে সরাসরি qtyNeeded * fallbackPrice করায় প্রতিটা ইউনিটের দাম
                    // ভুলভাবে পুরো-প্যাক-দামের সমান ধরা হচ্ছিল (৩০ × ৩০০ = ৳৯,০০০,
                    // যেখানে আসল কস্ট ছিল মাত্র ৳৩০০)। এখন pack হলে multiplier দিয়ে
                    // ভাগ করে প্রকৃত প্রতি-ইউনিট ক্রয়মূল্য বের করা হচ্ছে।
                    const isPackItem = Boolean(item.packInfo?.id || item.packId);
                    const packMultiplier = Number(item.multiplier || item.packInfo?.multiplier || 1) || 1;
                    const rawPurchasePrice = Number(item.purchasePrice) || 0;

                    const perUnitPurchasePrice = isPackItem
                        ? rawPurchasePrice / packMultiplier
                        : rawPurchasePrice;

                    itemTotalCost += (qtyNeeded * perUnitPurchasePrice);
                }

                const avgCostPerUnit = totalDeductQty > 0 ? (itemTotalCost / totalDeductQty) : 0;

                const createdSaleItem = await tx.saleItem.create({
                    data: {
                        saleId: newSale.id,
                        productId: prodId,
                        quantity: cartQty,
                        unitPrice: sellingPrice,
                        purchasePrice: Number(item.purchasePrice) || 0,
                        discount: itemDiscount,
                        subtotal: itemSubtotal,
                        costPriceAtSale: avgCostPerUnit,
                        totalCost: itemTotalCost,
                        layerDeductions: {
                            create: layerDeductionsToCreate.map(d => ({
                                inventoryLayerId: d.inventoryLayerId,
                                quantityTaken: d.quantityTaken,
                                unitCost: d.unitCost
                            }))
                        }
                    }
                });

                saleItemsData.push(createdSaleItem);

                // প্যাক স্টক আপডেট
                // ✅ আগে packRecord আলাদা fetch করে তার stock থেকে বিয়োগ করে সরাসরি
                // সংখ্যা বসানো হতো (`stock: newValue`)। একই পণ্যের ২টা আলাদা pack row
                // ধারাবাহিকভাবে প্রসেস হলে এতে সমস্যা হতো না (যেহেতু প্যাক আইডি আলাদা),
                // কিন্তু নিরাপত্তার জন্য (parallel/race-condition এড়াতে) atomic decrement
                // ব্যবহার করা হচ্ছে, ঠিক প্রোডাক্টের মতোই।
                if (item.packInfo?.id || item.packId) {
                    const targetPackId = Number(item.packInfo?.id || item.packId);
                    await tx.productPack.update({
                        where: { id: targetPackId },
                        data: {
                            stock: { decrement: cartQty }
                        }
                    });
                }

                // মূল Product টেবিলের স্টক কমানো
                // ✅ আগে এখানে ছিল মূল বাগ:
                //   const productRecord = productMap.get(prodId);
                //   const currentQty = Number(productRecord.quantity || 0);
                //   quantity: Math.max(0, currentQty - totalDeductQty)
                // productMap লোডেড হয়েছিল transaction শুরুতে, ট্রানজেকশন চলাকালীন
                // আপডেট হয়নি। ফলে একই productId-এর ২য়/৩য় pack-row প্রসেস হওয়ার সময়ও
                // currentQty সবসময় "অরিজিনাল" quantity-ই থাকত, এবং প্রতিটা update
                // আগের deduction মুছে নতুন করে বিয়োগ করত (overwrite) — তাই একটা pack-এর
                // deduction হারিয়ে যেত। atomic `decrement` ব্যবহার করায় প্রতিটা row
                // নিজে নিজের deduction যোগ করে, কেউ কাউকে overwrite করে না।
                await tx.product.update({
                    where: { id: prodId },
                    data: {
                        quantity: { decrement: totalDeductQty }
                    }
                });
            }

            return {
                ...newSale,
                saleItems: saleItemsData
            };
        }, {
            maxWait: 15000,
            timeout: 15000
        });

        return res.status(201).json({
            success: true,
            message: "সেল এবং ইনভয়েস FIFO লেয়ার অনুযায়ী সফলভাবে তৈরি হয়েছে!",
            invoiceNo: result.invoiceNo,
            data: result
        });

    } catch (error) {
        console.error("Sale transaction critical error details:", error);
        return res.status(500).json({
            success: false,
            message: `সার্ভারে সেল প্রসেস করতে সমস্যা হয়েছে: ${error.message}`
        });
    }
};

export const getSales = async (req, res) => {
    try {
        const { shopId } = req.query; 
        const filterShopId = shopId ? Number(shopId) : (req.user?.shopId ? Number(req.user.shopId) : undefined);

        const sales = await prisma.sale.findMany({
            where: filterShopId ? { shopId: filterShopId } : {},
            include: {
                customer: true,
                saleItems: {
                    include: {
                        product: true,
                        layerDeductions: true 
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({
            success: true,
            count: sales.length,
            data: sales
        });

    } catch (error) {
        console.error("Error fetching sales:", error);
        return res.status(500).json({
            success: false,
            message: "সেলস ডেটা লোড করতে সমস্যা হয়েছে।",
            error: error.message
        });
    }
};

export const getSalesSummary = async (req, res) => {
    try {
        const shopId = req.query.shopId || req.user?.shopId;
        const { filter, startDate, endDate } = req.query;

        if (!shopId) {
            return res.status(400).json({ success: false, message: "Shop ID is required" });
        }

        let dateFilter = {};
        const today = new Date();

        if (filter === 'today') {
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));

            dateFilter = {
                gte: startOfDay,
                lte: endOfDay,
            };
        } else if (filter === 'custom' && startDate && endDate) {
            const startCustom = new Date(startDate);
            startCustom.setHours(0, 0, 0, 0);

            const endCustom = new Date(endDate);
            endCustom.setHours(23, 59, 59, 999);

            dateFilter = {
                gte: startCustom,
                lte: endCustom,
            };
        }

        const sales = await prisma.sale.findMany({
            where: {
                shopId: Number(shopId),
                ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
            },
            include: {
                saleItems: true,
            },
        });

        let totalSales = 0;
        let cashSales = 0;
        let digitalSales = 0;
        let totalProfit = 0;

        sales.forEach((sale) => {
            totalSales += Number(sale.grandTotal) || 0;

            if (sale.paymentMethod === 'CASH') {
                cashSales += Number(sale.grandTotal) || 0;
            } else {
                digitalSales += Number(sale.grandTotal) || 0;
            }

            if (sale.saleItems && Array.isArray(sale.saleItems)) {
                sale.saleItems.forEach((item) => {
                    const itemSubtotal = Number(item.subtotal) || 0;
                    const itemTotalCost = Number(item.totalCost) || 0; 
                    const itemProfit = itemSubtotal - itemTotalCost;
                    totalProfit += itemProfit;
                });
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                totalSales,
                cashSales,
                digitalSales,
                totalProfit: Math.round(totalProfit * 100) / 100,
            },
        });

    } catch (err) {
        console.error("Sales Summary Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};