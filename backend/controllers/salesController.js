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
            // ১. প্রথমে সেলস রেকর্ড তৈরি করা (saleItems ছাড়া, কারণ FIFO কস্ট হিসাব করে আইটেমগুলো পরে দেওয়া হবে)
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

            // ২. প্রতিটি কার্ট আইটেমের জন্য FIFO লজিক চালিয়ে স্টক কাটা এবং কস্ট হিসাব করা
            for (let item of items) {
                const prodId = Number(item.productId || item.id);
                const cartQty = Number(item.quantity) || 1; // প্যাক বা ইউনিট সংখ্যা
                const multiplier = Number(item.multiplier || item.packInfo?.multiplier || 1);
                const totalDeductQty = cartQty * multiplier; // মোট প্রকৃত ইউনিট পরিমাণ

                const sellingPrice = Number(item.price) || 0;
                const itemDiscount = Number(item.discount) || 0;
                const itemSubtotal = (sellingPrice * cartQty) - itemDiscount;

                // ক) FIFO নিয়মে পুরোনো লেয়ারগুলো থেকে স্টক কাটার জন্য ফেচ করা
                const activeLayers = await tx.inventoryLayer.findMany({
                    where: {
                        productId: prodId,
                        remainingQty: { gt: 0 }
                    },
                    orderBy: { createdAt: 'asc' } // সবচেয়ে পুরোনো লেয়ার আগে আসবে
                });

                let qtyNeeded = totalDeductQty;
                let itemTotalCost = 0;
                const layerDeductionsToCreate = [];

                for (const layer of activeLayers) {
                    if (qtyNeeded <= 0) break;

                    const availableInLayer = Number(layer.remainingQty);
                    const takeQty = Math.min(qtyNeeded, availableInLayer);

                    // লেয়ারের বাকি স্টক কমানো
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

                // যদি লেয়ারে পর্যাপ্ত স্টক না থাকে, তবে ফলব্যাক হিসেবে প্রোডাক্টের বর্তমান purchasePrice ধরা হবে
                if (qtyNeeded > 0) {
                    const fallbackPrice = Number(item.purchasePrice) || 0;
                    itemTotalCost += (qtyNeeded * fallbackPrice);
                }

                const avgCostPerUnit = totalDeductQty > 0 ? (itemTotalCost / totalDeductQty) : 0;

                // খ) SaleItem এবং FIFO Layer Deductions একসাথে তৈরি করার ডেটা প্রস্তুত করা
                const createdSaleItem = await tx.saleItem.create({
                    data: {
                        saleId: newSale.id,
                        productId: prodId,
                        quantity: cartQty,
                        unitPrice: sellingPrice,
                        purchasePrice: Number(item.purchasePrice) || 0,
                        discount: itemDiscount,
                        subtotal: itemSubtotal,
                        costPriceAtSale: avgCostPerUnit, // FIFO অনুযায়ী ঐ মুহূর্তের ইউনিট কস্ট স্ন্যাপশট
                        totalCost: itemTotalCost,        // মোট COGS
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

                // গ) ProductPack স্টক আপডেট (যদি প্যাক থাকে)
                if (item.packInfo?.id || item.packId) {
                    const targetPackId = Number(item.packInfo?.id || item.packId);
                    const packRecord = await tx.productPack.findUnique({ where: { id: targetPackId } });
                    if (packRecord) {
                        await tx.productPack.update({
                            where: { id: targetPackId },
                            data: {
                                stock: Math.max(0, Number(packRecord.stock || 0) - cartQty)
                            }
                        });
                    }
                }

                // ঘ) মূল Product টেবিলের মেইন স্টক কমানো
                const productRecord = await tx.product.findUnique({ where: { id: prodId } });
                const currentQty = productRecord ? Number(productRecord.quantity || 0) : 0;

                await tx.product.update({
                    where: { id: prodId },
                    data: {
                        quantity: Math.max(0, currentQty - totalDeductQty)
                    }
                });
            }

            // সম্পূর্ণ সেল রেকর্ড রিটার্ন করার সময় saleItems সহ রিটার্ন করা
            return {
                ...newSale,
                saleItems: saleItemsData
            };
        });

        return res.status(201).json({
            success: true,
            message: "সেল এবং ইনভয়েস FIFO লেয়ার অনুযায়ী সফলভাবে তৈরি হয়েছে!",
            invoiceNo: result.invoiceNo,
            data: result
        });

    } catch (error) {
        console.error("Sale transaction critical error details:", error);
        return res.status(500).json({
            success: false,
            message: `সার্ভারে সেল প্রসেস করতে সমস্যা হয়েছে: ${error.message}`,
            errorStack: error.stack
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
                        layerDeductions: true // FIFO লেয়ার ডিডাকশন দেখতে চাইলে
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

        // আপনার প্রিজমা স্কিমা অনুযায়ী মডেলের নাম 'sale' বা 'sales' হতে পারে (এখানে 'sale' ব্যবহার করা হয়েছে)
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
                    const itemTotalCost = Number(item.totalCost) || 0; // FIFO অনুযায়ী সঠিক মোট কস্ট (COGS)
                    const discount = Number(item.discount) || 0;

                    // নিখুঁত প্রফিট সূত্র: সাবটোটাল - মোট FIFO কস্ট
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