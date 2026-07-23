import prisma from "../config/db.js";

// ইনভয়েস নম্বর জেনারেট করার একটি ছোট ফাংশন (যেমন: INV-171928374)
const generateInvoiceNo = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `INV-${timestamp}-${randomNum}`;
};

export const createSale = async (req, res) => {
    try {
        const { 
            shopId,              // কোন শপ থেকে বিক্রি হচ্ছে
            customerId,          // কাস্টমার আইডি (অপশনাল হতে পারে)
            items,               // কার্ট আইটেমগুলোর অ্যারে
            subTotal, 
            discountType,        // 'FIXED' অথবা 'PERCENTAGE'
            discountValue,       // ডিসকাউন্টের পরিমাণ বা পার্সেন্টেজ
            discountAmount,      // মোট ডিসকাউন্ট টাকা
            vatPercentage, 
            vatAmount, 
            payableAmount,       // এটি grandTotal হিসেবে যাবে
            receivedAmount,      // এটি paidAmount হিসেবে যাবে
            changeAmount, 
            paymentMethod,       // 'CASH', 'BKASH', 'CARD'
            paymentStatus,       // 'PAID', 'DUE', 'PARTIAL'
            notes 
        } = req.body;

        // ১. বেসিক ভ্যালিডেশন
        if (!items || items.length === 0) {
            return res.status(400).json({ message: "❌ কার্ট সম্পূর্ণ খালি!" });
        }

        if (!shopId) {
            return res.status(400).json({ message: "❌ শপ আইডি পাওয়া যায়নি!" });
        }

        // ২. ডিউ অ্যামাউন্ট ও পেমেন্ট স্ট্যাটাস ক্যালকুলেশন
        const grandTotalVal = Number(payableAmount) || 0;
        const paidAmountVal = Number(receivedAmount) || 0;
        let dueAmountVal = grandTotalVal - paidAmountVal;
        if (dueAmountVal < 0) dueAmountVal = 0;

        // যদি পেমেন্ট স্ট্যাটাস ফ্রন্টএন্ড থেকে না আসে তবে অটো নির্ধারণ করা
        let finalPaymentStatus = paymentStatus;
        if (!finalPaymentStatus) {
            if (paidAmountVal >= grandTotalVal) finalPaymentStatus = "PAID";
            else if (paidAmountVal > 0) finalPaymentStatus = "PARTIAL";
            else finalPaymentStatus = "DUE";
        }

        // ৩. Prisma Transaction ব্যবহার করে একসাথে Sale এবং SaleItem তৈরি করা এবং স্টক কমানো
        const result = await prisma.$transaction(async (tx) => {
            // ক. মূল 'Sale' টেবিলে ডাটা ইনসার্ট করা (Nested Create দিয়ে SaleItem সহ)
            const newSale = await tx.sale.create({
                data: {
                    invoiceNo: generateInvoiceNo(),
                    shopId: Number(shopId),
                    customerId: customerId ? Number(customerId) : null,
                    createdBy: Number(req.user.id), // মিডলওয়্যার থেকে লগইন করা ইউজারের আইডি
                    subtotal: Number(subTotal) || 0,
                    discountType: discountType || null,
                    discountValue: Number(discountValue) || 0,
                    discountAmount: Number(discountAmount) || 0,
                    vatPercentage: Number(vatPercentage) || 0,
                    vatAmount: Number(vatAmount) || 0,
                    grandTotal: grandTotalVal,
                    paidAmount: paidAmountVal,
                    dueAmount: dueAmountVal,
                    changeAmount: Number(changeAmount) || 0,
                    paymentMethod: paymentMethod || "CASH",
                    paymentStatus: finalPaymentStatus,
                    notes: notes || null,

                    // আপনার স্কিমার 'saleItems' রিলেশনের সাথে ম্যাপ করা হলো
                    saleItems: {
                        create: items.map(item => {
                            const qty = Number(item.quantity) || 1;
                            const price = Number(item.price) || 0;
                            const itemDiscount = Number(item.discount) || 0;
                            // সাবটোটাল হিসাব: (একক দাম * পরিমাণ) - ডিসকাউন্ট
                            const itemSubtotal = (price * qty) - itemDiscount;

                            return {
                                productId: Number(item.productId),
                                quantity: qty,
                                unitPrice: price,
                                purchasePrice: Number(item.purchasePrice) || 0, // প্রোডাক্ট টেবিল থেকে থাকলে দিতে পারেন
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

            // খ. স্টক আপডেট করা (প্রতিটি বিক্রিত পণ্যের জন্য স্টক থেকে পরিমাণ কমিয়ে দেওয়া)
            for (let item of items) {
                await tx.product.update({
                    where: { id: Number(item.productId) },
                    data: {
                        stock: {
                            decrement: Number(item.quantity) || 0
                        }
                    }
                });
            }

            return newSale;
        });

        // ৪. সফল রেসপন্স পাঠানো
        return res.status(201).json({
            success: true,
            message: "সেল এবং ইনভয়েস সফলভাবে তৈরি হয়েছে!",
            invoiceNo: result.invoiceNo,
            data: result
        });

    } catch (error) {
        console.error("Sale transaction error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "সার্ভারে সেল প্রসেস করতে সমস্যা হয়েছে।", 
            error: error.message 
        });
    }
};