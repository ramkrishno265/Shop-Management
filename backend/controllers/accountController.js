import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// =================================================================
// ১. অ্যাকাউন্টস সামারি ও ড্যাশবোর্ড মেট্রিকস ফেচ করা (Account Table ভিত্তিক)
// =================================================================
export const getAccountsSummary = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Shop ID প্রয়োজন।" });
    }

    const numericShopId = Number(shopId);

    // ১. অ্যাকাউন্ট টেবিল থেকে ক্যাশ ও ব্যাংক ব্যালেন্স সরাসরি নেওয়া
    const accounts = await prisma.account.findMany({
      where: { shopId: numericShopId }
    });

    let cashInHand = 0;
    let bankBalance = 0;

    accounts.forEach(acc => {
      if (acc.type === 'CASH') {
        cashInHand += Number(acc.balance || 0);
      } else {
        bankBalance += Number(acc.balance || 0);
      }
    });

    // ২. সেলস থেকে মোট বিক্রি ও মোট পাওনা (Receivable)
    const sales = await prisma.sale.findMany({
      where: { shopId: numericShopId },
      select: { grandTotal: true, dueAmount: true }
    });

    const rawTotalSales = sales.reduce((acc, s) => acc + Number(s.grandTotal || 0), 0);
    const totalReceivable = sales.reduce((acc, s) => acc + Number(s.dueAmount || 0), 0);

    // কাস্টমার রিটার্নগুলোর মোট রিফান্ড অ্যামাউন্ট বের করা (নেট সেলস সঠিক রাখার জন্য)
    const customerReturns = await prisma.customerReturn.findMany({
      where: { shopId: numericShopId },
      select: { refundAmount: true }
    });
    const totalCustomerReturns = customerReturns.reduce((acc, r) => acc + Number(r.refundAmount || 0), 0);

    // নেট বিক্রি = মোট বিক্রি - মোট রিটার্ন
    const totalSales = Math.max(0, rawTotalSales - totalCustomerReturns);

    // ৩. ক্রয় ও সাপ্লায়ার দেনা (Payable)
    const purchases = await prisma.purchase.findMany({
      where: { shopId: numericShopId },
      select: { due_amount: true }
    });
    const totalPayable = purchases.reduce((acc, p) => acc + Number(p.due_amount || 0), 0);

    // ৪. দোকান খরচ (Expenses)
    const expenses = await prisma.expense.findMany({
      where: { shopId: numericShopId },
      select: { amount: true }
    });
    const totalExpense = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // ৫. মোট মূলধন ইনভেস্ট
    const capitals = await prisma.capital.findMany({
      where: { shopId: numericShopId },
      select: { amount: true }
    });
    const totalInvestedCapital = capitals.reduce((acc, c) => acc + Number(c.amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        cashInHand,
        bankBalance,
        totalReceivable,
        totalPayable,
        totalSales,
        totalExpense,
        totalInvestedCapital
      }
    });

  } catch (error) {
    console.error("Accounts Summary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ২. মূলধন ইনভেস্ট সেভ করার কন্ট্রোলার (Account & Transaction Integrated)
// =================================================================
export const addCapital = async (req, res) => {
  try {
    const { amount, accountId, note, date } = req.body;
    const shopId = req.user?.shopId || req.body.shopId;
    const userId = req.user?.id || 1;

    if (!shopId || !amount || !accountId) {
      return res.status(400).json({ success: false, message: "প্রয়োজনীয় তথ্য (Shop ID, Amount, Account ID) অনুপস্থিত।" });
    }

    const numericAmount = Number(amount);
    const numericShopId = Number(shopId);
    const numericAccountId = Number(accountId);

    const result = await prisma.$transaction(async (tx) => {
      // ১. ক্যাপিটাল রেকর্ড তৈরি
      const capital = await tx.capital.create({
        data: {
          shopId: numericShopId,
          userId: Number(userId),
          amount: numericAmount,
          note: note || "ব্যক্তিগত মূলধন ইনভেস্ট",
          date: date || new Date().toISOString().split('T')[0]
        }
      });

      // ২. সংশ্লিষ্ট অ্যাকাউন্টে টাকা যোগ করা (Increment)
      await tx.account.update({
        where: { id: numericAccountId },
        data: { balance: { increment: numericAmount } }
      });

      // ৩. সেন্ট্রাল ট্রানজাকশন লেজারে এন্ট্রি (IN)
      await tx.transaction.create({
        data: {
          shopId: numericShopId,
          accountId: numericAccountId,
          type: 'IN',
          amount: numericAmount,
          category: 'CAPITAL',
          referenceId: capital.id,
          note: `Capital Investment: ${note || 'Personal'}`,
          date: date || new Date().toISOString().split('T')[0],
          createdById: Number(userId)
        }
      });

      return capital;
    });

    return res.status(201).json({
      success: true,
      message: "মূলধন সফলভাবে যুক্ত হয়েছে!",
      data: result
    });
  } catch (error) {
    console.error("Add Capital Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৩. টাকা উত্তোলন (Withdrawal) সেভ করার কন্ট্রোলার (Account & Transaction Integrated)
// =================================================================
export const addWithdrawal = async (req, res) => {
  try {
    const { amount, accountId, note, date } = req.body;
    const shopId = req.user?.shopId || req.body.shopId;
    const userId = req.user?.id || 1;

    if (!shopId || !amount || !accountId) {
      return res.status(400).json({ success: false, message: "প্রয়োজনীয় তথ্য (Shop ID, Amount, Account ID) অনুপস্থিত।" });
    }

    const numericAmount = Number(amount);
    const numericShopId = Number(shopId);
    const numericAccountId = Number(accountId);

    const result = await prisma.$transaction(async (tx) => {
      // ১. অ্যাকাউন্ট ব্যালেন্স চেক করা
      const account = await tx.account.findUnique({ where: { id: numericAccountId } });
      if (!account || account.balance < numericAmount) {
        throw new Error(`অপর্যাপ্ত ব্যালেন্স! অ্যাকাউন্টে (${account?.name || 'Selected Account'}) পর্যাপ্ত টাকা নেই।`);
      }

      // ২. উইথড্রল রেকর্ড তৈরি
      const withdrawal = await tx.withdrawal.create({
        data: {
          shopId: numericShopId,
          userId: Number(userId),
          amount: numericAmount,
          source: account.type, // 'CASH' বা 'BANK'
          note: note || "মালিকের ব্যক্তিগত উত্তোলন",
          date: date || new Date().toISOString().split('T')[0]
        }
      });

      // ৩. অ্যাকাউন্ট থেকে টাকা কমানো (Decrement)
      await tx.account.update({
        where: { id: numericAccountId },
        data: { balance: { decrement: numericAmount } }
      });

      // ৪. সেন্ট্রাল ট্রানজাকশন লেজারে এন্ট্রি (OUT)
      await tx.transaction.create({
        data: {
          shopId: numericShopId,
          accountId: numericAccountId,
          type: 'OUT',
          amount: numericAmount,
          category: 'WITHDRAWAL',
          referenceId: withdrawal.id,
          note: `Withdrawal: ${note || 'Personal'}`,
          date: date || new Date().toISOString().split('T')[0],
          createdById: Number(userId)
        }
      });

      return withdrawal;
    });

    return res.status(201).json({
      success: true,
      message: "উত্তোলন সফলভাবে রেকর্ড করা হয়েছে!",
      data: result
    });
  } catch (error) {
    console.error("Add Withdrawal Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৪. সেন্ট্রাল ট্রানজাকশন লেজার থেকে সকল লেনদেন ফেচ করা
// =================================================================
export const getAllTransactions = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Shop ID প্রয়োজন।" });
    }

    const numericShopId = Number(shopId);

    // সেন্ট্রাল ট্রানজাকশন টেবিল থেকে অ্যাকাউন্ট ইনফোসহ সব লেনদেন ফেচ করা
    const transactions = await prisma.transaction.findMany({
      where: { shopId: numericShopId },
      include: {
        account: { select: { id: true, name: true, type: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      date: tx.date,
      title: tx.note || tx.category,
      category: tx.category,
      type: tx.type, // 'IN' অথবা 'OUT'
      method: tx.account?.name || 'Cash',
      amount: tx.amount,
      account: tx.account,
      createdAt: tx.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: formattedTransactions
    });

  } catch (error) {
    console.error("Transactions Fetch Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৫. শপের সকল অ্যাকাউন্ট ফেচ করা
// =================================================================
export const getShopAccounts = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Shop ID প্রয়োজন।" });
    }

    const accounts = await prisma.account.findMany({
      where: { shopId: Number(shopId) },
      orderBy: { id: 'asc' }
    });

    return res.status(200).json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error("Get Accounts Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};