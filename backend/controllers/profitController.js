import prisma from "../config/db.js";

export const getProfitReport = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { type, startDate, endDate } = req.query;

    const where = {
      shopId: Number(shopId),
    };

    const returnWhere = {
      shopId: Number(shopId),
    };

    // Today filter
    if (type === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      where.createdAt = {
        gte: today,
        lt: tomorrow,
      };

      returnWhere.createdAt = {
        gte: today,
        lt: tomorrow,
      };
    }

    // Date Range filter
    if (startDate && endDate) {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);

      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: startDateTime,
        lte: endDateTime,
      };

      returnWhere.createdAt = {
        gte: startDateTime,
        lte: endDateTime,
      };
    }

    const [sales, customerReturns] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          saleItems: true,
        },
      }),
      prisma.customerReturn.findMany({
        where: returnWhere,
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    let totalSale = 0;
    let totalPurchase = 0; 
    let totalProfit = 0;
    let totalDiscount = 0; 

    sales.forEach((sale) => {
      totalSale += Number(sale.grandTotal) || 0;
      totalDiscount += Number(sale.discountAmount) || 0;

      sale.saleItems.forEach((item) => {
        const itemSubtotal = Number(item.subtotal) || (Number(item.unitPrice) * Number(item.quantity));

        const itemCost = Number(item.totalCost) > 0
          ? Number(item.totalCost)
          : (Number(item.purchasePrice) * Number(item.quantity));

        totalPurchase += itemCost;

        const itemProfit = itemSubtotal - itemCost;
        totalProfit += itemProfit;
      });
    });

    let totalReturnAmount = 0;
    let totalReturnCost = 0;

    customerReturns.forEach((ret) => {
      totalReturnAmount += Number(ret.refundAmount) || Number(ret.totalAmount) || 0;

      ret.items.forEach((retItem) => {
        const retQty = Number(retItem.quantity) || 0;
        const costPrice = Number(retItem.product?.purchasePrice) || 0;
        totalReturnCost += (costPrice * retQty);
      });
    });

    // ✅ এখানে সেফটি চেক দেওয়া হয়েছে যাতে নিট বিক্রি কখনো মাইনাসে (Negative) না যায়
    const netSale = totalSale >= totalReturnAmount ? totalSale - totalReturnAmount : 0;
    
    const baseProfitAfterDiscount = totalProfit - totalDiscount;
    const returnProfitAdjustment = totalReturnAmount - totalReturnCost; 
    const finalNetProfit = baseProfitAfterDiscount - returnProfitAdjustment;

    return res.status(200).json({
      success: true,
      type: type || "custom",
      totalInvoice: sales.length,
      totalReturnCount: customerReturns.length,
      totalSale: Math.round(netSale * 100) / 100,
      grossSale: Math.round(totalSale * 100) / 100,
      totalReturn: Math.round(totalReturnAmount * 100) / 100,
      totalPurchase: Math.round((totalPurchase - totalReturnCost) * 100) / 100,
      totalProfit: Math.round(finalNetProfit * 100) / 100,
    });
  } catch (err) {
    console.log("Profit Report Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};