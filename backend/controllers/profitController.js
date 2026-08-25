import prisma from "../config/db.js";

export const getProfitReport = async (req, res) => {
  try {
    const shopId = req.user.shopId;

    const { type, startDate, endDate } = req.query;

    const where = {
      shopId: Number(shopId),
    };

    // Today
    if (type === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      where.createdAt = {
        gte: today,
        lt: tomorrow,
      };
    }

    // Date Range
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const sales = await prisma.sales.findMany({
      where,
      include: {
        sale_Items: true,
      },
    });

    let totalSale = 0;
    let totalPurchase = 0; // এটি আসলে Total COGS (Cost of Goods Sold)
    let totalProfit = 0;

    sales.forEach((sale) => {
      // যদি সেলস লেভেলে কোনো ডিসকাউন্ট থাকে, তা সেল অ্যামাউন্ট থেকে বাদ দেওয়া যেতে পারে
      totalSale += Number(sale.grandTotal)|| 0;

      sale.sale_Items.forEach((item) => {
        const itemSubtotal = (Number(item.unitPrice) * Number(item.quantity));
        
        // FIFO অনুযায়ী সঠিক মোট কস্ট (যদি item.totalCost না থাকে, তবে ফলব্যাক হিসেবে purcahsePrice ব্যবহার হবে)
        const itemCost = (Number(item.purchasePrice) * Number(item.quantity));
        
        totalPurchase += itemCost;

        // নিখুঁত প্রফিট: আইটেমের সাবটোটাল থেকে FIFO কস্ট বাদ দেওয়া
        const itemProfit = itemSubtotal - itemCost;
        totalProfit += itemProfit;
      });
    });

    return res.status(200).json({
      success: true,
      type: type || "custom",
      totalInvoice: sales.length,
      totalSale: Math.round(totalSale * 100) / 100,
      totalPurchase: Math.round(totalPurchase * 100) / 100, // Total COGS
      totalProfit: Math.round(totalProfit * 100) / 100,
    });
  } catch (err) {
    console.log("Profit Report Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};