import prisma from "../config/db.js";

// =================================================================
// ১. অ্যাকাউন্টস সামারি ও ড্যাশবোর্ড মেট্রিকস ফেচ করা (ডেটাবেজ ভিত্তিক)
// =================================================================
export const getAccountsSummary = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Shop ID প্রয়োজন।" });
    }

    const numericShopId = Number(shopId);

    // ১. সেলস ডেটা এবং পেমেন্ট মেথড চেক করা
    const sales = await prisma.sale.findMany({
      where: { shopId: numericShopId },
      select: { grandTotal: true, paidAmount: true, dueAmount: true, paymentMethod: true }
    });

    const totalSales = sales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalReceivable = sales.reduce((acc, s) => acc + s.dueAmount, 0); // মোট পাওনা

    // CASH হলে ক্যাশ ইন হ্যান্ডে যাবে, অন্যথায় (BKASH, CARD ইত্যাদি) ব্যাংক/ওয়ালেটে যাবে
    const cashSalesPaid = sales
      .filter(s => s.paymentMethod === 'CASH')
      .reduce((acc, s) => acc + s.paidAmount, 0);

    const digitalSalesPaid = sales
      .filter(s => s.paymentMethod && s.paymentMethod !== 'CASH')
      .reduce((acc, s) => acc + s.paidAmount, 0);

    // ২. ক্রয় ও সাপ্লায়ার দেনা
    const purchases = await prisma.purchase.findMany({
      where: { shopId: numericShopId },
      select: { due_amount: true }
    });
    const totalPayable = purchases.reduce((acc, p) => acc + p.due_amount, 0); // মোট দেনা

    // ৩. দোকান খরচ (Expenses)
    const expenses = await prisma.expense.findMany({
      where: { shopId: numericShopId },
      select: { amount: true }
    });
    const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);

    // ৪. কাস্টমার ও সাপ্লায়ার পেমেন্ট
    const customerPayments = await prisma.customerPayment.findMany({
      where: { shopId: numericShopId },
      select: { amount: true, paymentMethod: true }
    });
    const cashCustomerPaid = customerPayments
      .filter(p => p.paymentMethod === 'CASH')
      .reduce((acc, p) => acc + p.amount, 0);

    const digitalCustomerPaid = customerPayments
      .filter(p => p.paymentMethod && p.paymentMethod !== 'CASH')
      .reduce((acc, p) => acc + p.amount, 0);

    const supplierPayments = await prisma.supplierPayment.findMany({
      where: { shopId: numericShopId },
      select: { amount: true, paymentMethod: true }
    });
    const totalSupplierCashPaid = supplierPayments
      .filter(p => p.paymentMethod === 'CASH')
      .reduce((acc, sp) => acc + sp.amount, 0);

    // ৫. ডেটাবেজ থেকে ক্যাপিটাল (মূলধন ইনভেস্ট) ফেচ করা
    const capitals = await prisma.capital.findMany({
      where: { shopId: numericShopId },
      select: { amount: true }
    });
    const totalInvestedCapital = capitals.reduce((acc, c) => acc + c.amount, 0);

    // ৬. ডেটাবেজ থেকে উইথড্রল (টাকা উত্তোলন) ফেচ করা
    const withdrawals = await prisma.withdrawal.findMany({
      where: { shopId: numericShopId },
      select: { amount: true, source: true }
    });
    const cashWithdraw = withdrawals
      .filter(w => w.source === 'CASH')
      .reduce((acc, w) => acc + w.amount, 0);

    const bankWithdraw = withdrawals
      .filter(w => w.source === 'BANK')
      .reduce((acc, w) => acc + w.amount, 0);

    // ৭. চূড়ান্ত হিসাব:
    // ক্যাশ ইন হ্যান্ড = (মূলধন + নগদ বিক্রি + নগদ কাস্টমার পেমেন্ট) - (খরচ + ক্যাশ সাপ্লায়ার পেমেন্ট + ক্যাশ উত্তোলন)
    const cashInHand = (totalInvestedCapital + cashSalesPaid + cashCustomerPaid) - (totalExpense + totalSupplierCashPaid + cashWithdraw);

    // ব্যাংক ও ওয়ালেট = (ডিজিটাল বিক্রি + ডিজিটাল কাস্টমার পেমেন্ট) - ব্যাংক উত্তোলন
    const bankBalance = (digitalSalesPaid + digitalCustomerPaid) - bankWithdraw;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          cashInHand: Math.max(0, cashInHand),
          bankBalance: Math.max(0, bankBalance),
          totalReceivable,
          totalPayable,
          totalSales,
          totalExpense,
          totalInvestedCapital
        }
      }
    });

  } catch (error) {
    console.error("Accounts Summary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ২. মূলধন ইনভেস্ট সেভ করার কন্ট্রোলার
// =================================================================
export const addCapital = async (req, res) => {
  try {
    const { amount, note, date } = req.body;
    const shopId = req.user?.shopId;
    const userId = req.user?.id;

    if (!shopId || !amount) {
      return res.status(400).json({ success: false, message: "প্রয়োজনীয় তথ্য অনুপস্থিত।" });
    }

    const capital = await prisma.capital.create({
      data: {
        shopId: Number(shopId),
        userId: Number(userId),
        amount: Number(amount),
        note: note || "ব্যক্তিগত মূলধন ইনভেস্ট",
        date: date || new Date().toISOString().split('T')[0]
      }
    });

    return res.status(201).json({
      success: true,
      message: "মূলধন সফলভাবে যুক্ত হয়েছে!",
      data: capital
    });
  } catch (error) {
    console.error("Add Capital Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৩. টাকা উত্তোলন (Withdrawal) সেভ করার কন্ট্রোলার
// =================================================================
export const addWithdrawal = async (req, res) => {
  try {
    const { amount, source, note, date } = req.body;
    const shopId = req.user?.shopId;
    const userId = req.user?.id;

    if (!shopId || !amount || !source) {
      return res.status(400).json({ success: false, message: "প্রয়োজনীয় তথ্য অনুপস্থিত।" });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        shopId: Number(shopId),
        userId: Number(userId),
        amount: Number(amount),
        source: source, // 'CASH' অথবা 'BANK'
        note: note || "মালিকের ব্যক্তিগত উত্তোলন",
        date: date || new Date().toISOString().split('T')[0]
      }
    });

    return res.status(201).json({
      success: true,
      message: "উত্তোলন সফলভাবে রেকর্ড করা হয়েছে!",
      data: withdrawal
    });
  } catch (error) {
    console.error("Add Withdrawal Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =================================================================
// ৪. সকল ট্রানজ্যাকশন (সেলস, এক্সপেন্স, ক্যাপিটাল, উইথড্রল) ফেচ করা
// =================================================================
export const getAllTransactions = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Shop ID প্রয়োজন।" });
    }

    const numericShopId = Number(shopId);

    const [expenses, sales, capitals, withdrawals] = await Promise.all([
      prisma.expense.findMany({ where: { shopId: numericShopId }, orderBy: { createdAt: 'desc' } }),
      prisma.sale.findMany({ where: { shopId: numericShopId }, orderBy: { createdAt: 'desc' } }),
      prisma.capital.findMany({ where: { shopId: numericShopId }, orderBy: { createdAt: 'desc' } }),
      prisma.withdrawal.findMany({ where: { shopId: numericShopId }, orderBy: { createdAt: 'desc' } })
    ]);

    const formattedExpenses = expenses.map(e => ({
      id: `exp-${e.id}`,
      date: e.createdAt.toISOString().split('T')[0],
      title: `Expense: ${e.category}`,
      category: e.category,
      type: 'EXPENSE',
      method: 'CASH',
      amount: e.amount,
      createdAt: e.createdAt
    }));

    const formattedSales = sales.map(s => ({
      id: `sale-${s.id}`,
      date: s.createdAt.toISOString().split('T')[0],
      title: `Sales Invoice #${s.invoiceNo}`,
      category: 'Sales',
      type: 'INCOME',
      method: s.paymentMethod || 'CASH',
      amount: s.paidAmount,
      createdAt: s.createdAt
    }));

    const formattedCapitals = capitals.map(c => ({
      id: `cap-${c.id}`,
      date: c.date,
      title: `Capital Investment: ${c.note || 'Personal'}`,
      category: 'Capital',
      type: 'INCOME',
      method: 'CASH',
      amount: c.amount,
      createdAt: c.createdAt
    }));

    const formattedWithdrawals = withdrawals.map(w => ({
      id: `wd-${w.id}`,
      date: w.date,
      title: `Withdrawal (${w.source}): ${w.note || 'Personal'}`,
      category: 'Withdrawal',
      type: 'EXPENSE',
      method: w.source,
      amount: w.amount,
      createdAt: w.createdAt
    }));

    // সব ট্রানজ্যাকশন একসাথে মার্চ করে ডেট অনুযায়ী সাজানো
    const allTransactions = [
      ...formattedExpenses,
      ...formattedSales,
      ...formattedCapitals,
      ...formattedWithdrawals
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      data: allTransactions
    });

  } catch (error) {
    console.error("Transactions Fetch Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};