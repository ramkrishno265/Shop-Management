import prisma from "../config/db.js"; // আপনার প্রিজমা ক্লায়েন্টের পাথ এখানে ঠিক করে দেবেন

// ১. নতুন খরচ এন্ট্রি বা সেভ করার জন্য
export const addExpense = async (req, res) => {
  try {
    const { category, amount, note, shopId } = req.body;

    if (!category || !amount || !shopId) {
      return res.status(400).json({ 
        success: false, 
        message: "Category, amount and shopId are required" 
      });
    }

    const newExpense = await prisma.expense.create({
      data: {
        category,
        amount: Number(amount),
        note: note || '',
        shopId: Number(shopId),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: newExpense,
    });
  } catch (err) {
    console.error("Add Expense Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ২. খরচের তালিকা ও টোটাল খরচ ফেচ করার জন্য
export const getExpenses = async (req, res) => {
  try {
    const shopId = req.query.shopId || req.user?.shopId;
    const { filter, startDate, endDate } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: "Shop ID is required" 
      });
    }

    let dateFilter = {};
    const today = new Date();

    // ডেট ফিল্টার লজিক (ড্যাশবোর্ডের সাথে মিলিয়ে)
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

    // প্রিজমা কুয়েরি
    const expenses = await prisma.expense.findMany({
      where: {
        shopId: Number(shopId),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      orderBy: {
        createdAt: 'desc', // সাম্প্রতিক খরচগুলো সবার উপরে দেখানোর জন্য
      },
    });

    // মোট খরচের পরিমাণ হিসাব করা
    const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return res.status(200).json({
      success: true,
      totalExpense,
      data: expenses,
    });
  } catch (err) {
    console.error("Get Expense Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};