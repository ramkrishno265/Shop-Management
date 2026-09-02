// customerPayment.controller.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const collectPayment = async (req, res) => {
  const customerId = Number(req.params.customerId);
  const { amount, paymentMethod, notes } = req.body;

  // --- Auth/shop context ---
  const shopId = req.shopId || req.user?.shopId || Number(req.headers['x-shop-id']);
  const userId = req.user?.id;

  // --- Basic validation ---
  const amountNum = Number(amount);
  if (!customerId || isNaN(customerId)) {
    return res.status(400).json({ message: 'Invalid customer.' });
  }
  if (!amountNum || amountNum <= 0) {
    return res.status(400).json({ message: 'পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' });
  }
  if (!shopId) {
    return res.status(400).json({ message: 'Shop context missing.' });
  }
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ১. কাস্টমার এই shop-এর কিনা যাচাই করা
      const customer = await tx.customer.findFirst({
        where: { id: customerId, shopId }
      });
      if (!customer) {
        throw new Error('CUSTOMER_NOT_FOUND');
      }

      // ২. এই কাস্টমারের সব due থাকা sale, পুরনো থেকে নতুন (FIFO)
      const dueSales = await tx.sale.findMany({
        where: {
          customerId,
          shopId,
          dueAmount: { gt: 0 }
        },
        orderBy: { createdAt: 'asc' }
      });

      const totalDue = dueSales.reduce((acc, s) => acc + s.dueAmount, 0);

      if (totalDue <= 0) {
        throw new Error('NO_DUE');
      }
      if (amountNum > totalDue) {
        throw new Error('AMOUNT_EXCEEDS_DUE');
      }

      // ৩. CustomerPayment রেকর্ড তৈরি (মোট collection)
      const payment = await tx.customerPayment.create({
        data: {
          shopId,
          customerId,
          userId,
          amount: amountNum,
          paymentMethod: paymentMethod || 'CASH',
          notes: notes || null
        }
      });

      // ৪. FIFO অনুযায়ী allocate করা
      let remaining = amountNum;
      const allocations = [];

      for (const sale of dueSales) {
        if (remaining <= 0) break;

        const applyAmount = Math.min(sale.dueAmount, remaining);
        const newPaidAmount = sale.paidAmount + applyAmount;
        const newDueAmount = sale.dueAmount - applyAmount;

        let newStatus = 'PARTIAL';
        if (newDueAmount <= 0) newStatus = 'PAID';

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaidAmount,
            dueAmount: newDueAmount,
            paymentStatus: newStatus
          }
        });

        const allocation = await tx.salePaymentAllocation.create({
          data: {
            saleId: sale.id,
            customerPaymentId: payment.id,
            amountApplied: applyAmount
          }
        });

        allocations.push(allocation);
        remaining -= applyAmount;
      }

      const remainingDue = totalDue - amountNum;

      return { payment, allocations, remainingDue };
    });

    return res.status(201).json({
      message: 'Payment collected successfully.',
      data: result
    });
  } catch (err) {
    if (err.message === 'CUSTOMER_NOT_FOUND') {
      return res.status(404).json({ message: 'কাস্টমার পাওয়া যায়নি।' });
    }
    if (err.message === 'NO_DUE') {
      return res.status(400).json({ message: 'এই কাস্টমারের কোনো বকেয়া নেই।' });
    }
    if (err.message === 'AMOUNT_EXCEEDS_DUE') {
      return res.status(400).json({ message: 'পরিমাণ মোট বকেয়ার চেয়ে বেশি হতে পারবে না।' });
    }
    console.error('collectPayment error:', err);
    return res.status(500).json({ message: 'পেমেন্ট প্রসেস করতে সমস্যা হয়েছে।' });
  }
};

export const getCustomerPaymentHistory = async (req, res) => {
  const customerId = Number(req.params.customerId);
  const shopId = req.shopId || req.user?.shopId || Number(req.headers['x-shop-id']);

  try {
    const payments = await prisma.customerPayment.findMany({
      where: { customerId, shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        saleAllocations: {
          include: {
            sale: {
              select: { id: true, invoiceNo: true, grandTotal: true }
            }
          }
        },
        user: { select: { name: true } }
      }
    });

    return res.json({ data: payments });
  } catch (err) {
    console.error('getCustomerPaymentHistory error:', err);
    return res.status(500).json({ message: 'হিস্ট্রি লোড করতে সমস্যা হয়েছে।' });
  }
};