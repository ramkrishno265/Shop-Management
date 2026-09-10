import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// =================================================================
// ১. সাপ্লায়ার পেমেন্ট বা বকেয়া পরিশোধ সাবমিট করার কন্ট্রোলার
// =================================================================
export const createSupplierPayment = async (req, res) => {
  try {
    const shopId = req.shopId || req.user?.shopId || Number(req.headers['x-shop-id']) || req.body.shopId;
    const userId = req.user?.id || 1;
    const { supplierId, amount, paymentMethod, notes, accountId } = req.body;

    const amountNum = Number(amount);
    const numericShopId = Number(shopId);
    const numericSupplierId = Number(supplierId);

    if (!numericShopId || !numericSupplierId || !amountNum || amountNum <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "প্রয়োজনীয় তথ্য (Shop ID, Supplier ID, Valid Amount) অনুপস্থিত।" 
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // ১. সাপ্লায়ার এই শপের কিনা যাচাই করা
      const supplier = await tx.supplier.findFirst({
        where: { id: numericSupplierId, shopId: numericShopId }
      });
      if (!supplier) {
        throw new Error('SUPPLIER_NOT_FOUND');
      }

      // ২. FIFO অনুযায়ী সাপ্লায়ারের বکهয়া পারচেজগুলো বের করা (পুরনো থেকে নতুন)
      const duePurchases = await tx.purchase.findMany({
        where: {
          supplier_id: numericSupplierId,
          shopId: numericShopId,
          due_amount: { gt: 0 }
        },
        orderBy: { createdAt: 'asc' }
      });

      const totalDue = duePurchases.reduce((acc, p) => acc + Number(p.due_amount || 0), 0);

      if (totalDue > 0 && amountNum > totalDue) {
        // ইচ্ছে করলে কঠোরভাবে রেস্ট্রিক্ট করতে পারেন অথবা অতিরিক্ত টাকা অ্যাডভান্স ধরতে পারেন
        // এখানে পেমেন্ট নেওয়া যাবে তবে বকেয়ার বেশি হলে ওয়ার্নিং বা এরর দেওয়া যেতে পারে
      }

      // ৩. SupplierPayment রেকর্ড তৈরি করা
      const supplierPayment = await tx.supplierPayment.create({
        data: {
          shopId: numericShopId,
          supplierId: numericSupplierId,
          userId: Number(userId),
          amount: amountNum,
          paymentMethod: paymentMethod || 'CASH',
          notes: notes || null
        }
      });

      // ৪. FIFO অনুযায়ী Purchase গুলোর paid_amount ও due_amount আপডেট করা এবং Allocation তৈরি করা
      let remaining = amountNum;
      const allocations = [];

      for (const purchase of duePurchases) {
        if (remaining <= 0) break;

        const currentDue = Number(purchase.due_amount || 0);
        const applyAmount = Math.min(currentDue, remaining);
        
        const newPaidAmount = Number(purchase.paid_amount || 0) + applyAmount;
        const newDueAmount = currentDue - applyAmount;

        let newStatus = 'Partial';
        if (newDueAmount <= 0) newStatus = 'Paid';

        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paid_amount: newPaidAmount,
            due_amount: newDueAmount,
            payment_status: newStatus
          }
        });

        const allocation = await tx.purchasePaymentAllocation.create({
          data: {
            purchaseId: purchase.id,
            supplierPaymentId: supplierPayment.id,
            amountApplied: applyAmount
          }
        });

        allocations.push(allocation);
        remaining -= applyAmount;
      }

      // =================================================================
      // ৫. অ্যাকাউন্ট ব্যালেন্স ও সেন্ট্রাল ট্রানজাকশন লেজার আপডেট (OUT)
      // =================================================================
      let targetAccountId = accountId ? Number(accountId) : null;

      // যদি ফ্রন্টএন্ড থেকে accountId না আসে, তবে শপের ডিফল্ট ক্যাশ অ্যাকাউন্ট খুঁজে নেওয়া
      if (!targetAccountId) {
        const defaultAccount = await tx.account.findFirst({
          where: { shopId: numericShopId, type: 'CASH', isDefault: true }
        }) || await tx.account.findFirst({
          where: { shopId: numericShopId }
        });
        
        if (defaultAccount) {
          targetAccountId = defaultAccount.id;
        }
      }

      if (targetAccountId) {
        // ক) অ্যাকাউন্ট থেকে টাকা কমানো (Decrement - যেহেতু সাপ্লায়ারকে টাকা দেওয়া হচ্ছে)
        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: { decrement: amountNum } }
        });

        // খ) সেন্ট্রাল ট্রানজাকশন লেজারে 'OUT' এন্ট্রি তৈরি করা
        await tx.transaction.create({
          data: {
            shopId: numericShopId,
            accountId: targetAccountId,
            type: 'OUT', // টাকা শপ থেকে চলে যাচ্ছে তাই OUT
            amount: amountNum,
            category: 'SUPPLIER_PAYMENT',
            referenceId: supplierPayment.id,
            note: `Supplier Payment to: ${supplier.name}`,
            date: new Date().toISOString().split('T')[0],
            createdById: Number(userId)
          }
        });
      }
      // =================================================================

      return { supplierPayment, allocations };
    });

    return res.status(201).json({
      success: true,
      message: "সাপ্লায়ার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!",
      data: result
    });

  } catch (err) {
    if (err.message === 'SUPPLIER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'সাপ্লায়ার পাওয়া যায়নি।' });
    }
    console.error("Supplier Payment Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "পেমেন্ট প্রসেস করতে সমস্যা হয়েছে।"
    });
  }
};

// =================================================================
// ২. নির্দিষ্ট সাপ্লায়ারের পেমেন্ট হিস্ট্রি ফেচ করার কন্ট্রোলার
// =================================================================
export const getSupplierPaymentHistory = async (req, res) => {
  try {
    const supplierId = Number(req.params.supplierId);
    const shopId = req.shopId || req.user?.shopId || Number(req.headers['x-shop-id']);

    if (!supplierId) {
      return res.status(400).json({ success: false, message: "Supplier ID প্রয়োজন।" });
    }

    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId, shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        allocations: {
          include: {
            purchase: {
              select: { id: true, invoiceNo: true, total_amount: true }
            }
          }
        },
        user: { select: { name: true } }
      }
    });

    return res.status(200).json({
      success: true,
      data: payments
    });
  } catch (err) {
    console.error("Get Supplier Payment History Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "হিস্ট্রি লোড করতে সমস্যা হয়েছে।"
    });
  }
};