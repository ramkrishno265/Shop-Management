import prisma from "../config/db.js";

export const getProfitReport = async (req, res) => {
  try {
    const shopId = req.user.shopId;

    const { type, startDate, endDate } = req.query;

    const where = {
      shopId,
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

    const sales = await prisma.sale.findMany({
      where,
      include: {
        saleItems: true,
      },
    });

    let totalSale = 0;
    let totalPurchase = 0;
    let totalProfit = 0;

    sales.forEach((sale) => {
      sale.saleItems.forEach((item) => {
        const saleAmount = item.unitPrice * item.quantity;
        const purchaseAmount = item.purchasePrice * item.quantity;

        totalSale += saleAmount;
        totalPurchase += purchaseAmount;
        totalProfit += saleAmount - purchaseAmount;
      });
    });

    return res.status(200).json({
      success: true,
      type: type || "custom",
      totalInvoice: sales.length,
      totalSale,
      totalPurchase,
      totalProfit,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};