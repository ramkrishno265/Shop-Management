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

    const sales = await prisma.sale.findMany({
      where,
      include: {
        saleItems: true, // ✅ এখানে 'sale_Items' এর বদলে সঠিক নামটি বসানো হলো ('saleItems')
      },
    });

    let totalSale = 0;
    let totalPurchase = 0; // Total COGS
    let totalProfit = 0;

    sales.forEach((sale) => {
      totalSale += Number(sale.grandTotal) || 0;

      // এখন এখানেও 'saleItems' ব্যবহার করতে হবে
      sale.saleItems.forEach((item) => {
        const itemSubtotal = Number(item.subtotal) || (Number(item.unitPrice) * Number(item.quantity));
        
        // FIFO বা সেলের সময় সেভ করা totalCost ব্যবহার করা সবচেয়ে নিরাপদ
        const itemCost = Number(item.totalCost) > 0 
          ? Number(item.totalCost) 
          : (Number(item.purchasePrice) * Number(item.quantity));
        
        totalPurchase += itemCost;

        // নিখুঁত প্রফিট: সাবটোটাল থেকে কস্ট বাদ দেওয়া
        const itemProfit = itemSubtotal - itemCost;
        totalProfit += itemProfit;
      });
    });

    return res.status(200).json({
      success: true,
      type: type || "custom",
      totalInvoice: sales.length,
      totalSale: Math.round(totalSale * 100) / 100,
      totalPurchase: Math.round(totalPurchase * 100) / 100,
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