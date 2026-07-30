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
            return res.status(401).json({ success: false, message: "❌ অথেন্টিকেশন এরর: ইউজার আইডি পাওয়া যায়নি!" });
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

                    saleItems: {
                        create: items.map(item => {
                            const qty = Number(item.quantity) || 1;
                            const price = Number(item.price) || 0;
                            const itemDiscount = Number(item.discount) || 0;
                            const itemSubtotal = (price * qty) - itemDiscount;

                            return {
                                productId: Number(item.productId || item.id),
                                quantity: qty,
                                unitPrice: price,
                                purchasePrice: Number(item.purchasePrice) || 0,
                                discount: itemDiscount,
                                subtotal: itemSubtotal
                            };
                        })
                    }
                },
                include: {
                    saleItems: true
                }
            });

            // স্টক আপডেট করা
            for (let item of items) {
                const prodId = Number(item.productId || item.id);

                // প্রথমে বর্তমান প্রোডাক্টের তথ্য বা কুয়ান্টিটি বের করে নিতে পারেন অথবা সরাসরি মাইনাস করতে পারেন
                // যদি আপনার প্রোডাক্ট টেবিলে ফিল্ডের নাম 'quantity' হয়:
                const product = await tx.product.findUnique({ where: { id: prodId } });
                const currentQty = product ? product.quantity : 0;
                const buyQty = Number(item.quantity) || 0;

                await tx.product.update({
                    where: { id: prodId },
                    data: {
                        quantity: Math.max(0, currentQty - buyQty) // সরাসরি নতুন পরিমাণ সেট করে দেওয়া নিরাপদ
                    }
                });
            }

            return newSale;
        });

        return res.status(201).json({
            success: true,
            message: "সেল এবং ইনভয়েস সফলভাবে তৈরি হয়েছে!",
            invoiceNo: result.invoiceNo,
            data: result
        });

    } catch (error) {
        console.error("Sale transaction critical error details:", error);
        return res.status(500).json({
            success: false,
            message: `সার্ভারে সেল প্রসেস করতে সমস্যা হয়েছে: ${error.message}`, // মূল এরর মেসেজ সহ পাঠানো
            errorStack: error.stack
        });
    }
};


export const getSales = async (req, res) => {
    try {
        const { shopId } = req.query; // URL থেকে shopId নিতে পারেন (যেমন: /sales?shopId=1)
        
        // কুয়েরিতে শপ আইডি না থাকলে লগইন করা ইউজারের shopId বা টোকেন থেকে নিতে পারেন
        const filterShopId = shopId ? Number(shopId) : (req.user?.shopId ? Number(req.user.shopId) : undefined);

        const sales = await prisma.sale.findMany({
            where: filterShopId ? { shopId: filterShopId } : {},
            include: {
                saleItems: {
                    include: {
                        product: true // প্রোডাক্টের নাম বা ডিটেইলস সহ দেখতে চাইলে
                    }
                }
            },
            orderBy: {
                createdAt: 'desc' // নতুন সেলগুলো সবার উপরে দেখানোর জন্য
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

    // ফিল্টার লজিক
    if (filter === 'today') {
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

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

    console.log("Shop ID:", shopId);
    console.log("Date Filter applied:", dateFilter);

    // প্রফিট হিসাব করার জন্য saleItems সহ ডাটা কুয়েরি করা
    const sales = await prisma.sales.findMany({
      where: {
        shopId: Number(shopId),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      include: {
        saleItems: true, // প্রফিট বের করার জন্য আইটেমগুলোর ক্রয়মূল্য ও পরিমাণ দরকার
      },
    });

    console.log("Sales found from DB:", sales.length);

    let totalSales = 0;
    let cashSales = 0;
    let digitalSales = 0;
    let totalProfit = 0; // প্রফিট ট্র্যাক করার জন্য

    sales.forEach((sale) => {
      const amount = Number(sale.grand_total || sale.grandTotal || 0);
      totalSales += amount;

      const paymentMethod = (sale.paymentMethod || sale.paymentType || '').trim().toUpperCase();
      
      if (paymentMethod === 'CASH') {
        cashSales += amount;
      } else {
        digitalSales += amount; 
      }

      // প্রতিটি বিক্রয় আইটেম থেকে প্রফিট হিসাব করা
      if (sale.saleItems && Array.isArray(sale.saleItems)) {
        sale.saleItems.forEach((item) => {
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const purchasePrice = Number(item.purchasePrice) || 0;
          const discount = Number(item.discount) || 0;

          // প্রফিট = (বিক্রয়মূল্য - ক্রয়মূল্য) * পরিমাণ - ডিসকাউন্ট
          const itemProfit = ((unitPrice - purchasePrice) * qty) - discount;
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
        totalProfit: Math.round(totalProfit * 100) / 100, // দশমিকের পর দুই ঘর পর্যন্ত নিখুঁত রাখার জন্য
      },
    });

  } catch (err) {
    console.error("Sales Summary Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

