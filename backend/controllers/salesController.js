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
            items,               
            subTotal, 
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

        // ১. বেসিক ভ্যালিডেশন
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "❌ কার্ট সম্পূর্ণ খালি!" });
        }

        if (!shopId) {
            return res.status(400).json({ success: false, message: "❌ শপ আইডি পাওয়া যায়নি!" });
        }

        // লগইন করা ইউজারের আইডি মিডলওয়্যার থেকে নিশ্চিত করা
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "❌ অথেন্টিকেশন এরর: ইউজার আইডি পাওয়া যায়নি!" });
        }

        const grandTotalVal = Number(payableAmount) || 0;
        const paidAmountVal = Number(receivedAmount) || 0;
        let dueAmountVal = grandTotalVal - paidAmountVal;
        if (dueAmountVal < 0) dueAmountVal = 0;

        let finalPaymentStatus = paymentStatus;
        if (!finalPaymentStatus) {
            if (paidAmountVal >= grandTotalVal) finalPaymentStatus = "PAID";
            else if (paidAmountVal > 0) finalPaymentStatus = "PARTIAL";
            else finalPaymentStatus = "DUE";
        }

        // ২. ট্রানজেকশন শুরু
        const result = await prisma.$transaction(async (tx) => {
            const newSale = await tx.sale.create({
                data: {
                    invoiceNo: generateInvoiceNo(),
                    shopId: Number(shopId),
                    customerId: customerId ? Number(customerId) : null,
                    createdBy: Number(userId),
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

                    saleItems: {
                        create: items.map(item => {
                            const qty = Number(item.quantity) || 1;
                            const price = Number(item.price) || 0;
                            const itemDiscount = Number(item.discount) || 0;
                            const itemSubtotal = (price * qty) - itemDiscount;

                            return {
                                productId: Number(item.productId),
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

        return res.status(201).json({
            success: true,
            message: "সেল এবং ইনভয়েস সফলভাবে তৈরি হয়েছে!",
            invoiceNo: result.invoiceNo,
            data: result
        });

    } catch (error) {
        console.error("Sale transaction critical error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "সার্ভারে সেল প্রসেস করতে সমস্যা হয়েছে।", 
            error: error.message 
        });
    }
};