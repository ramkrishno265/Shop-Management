import prisma from "../config/db.js";

// শপের প্রোফাইল তথ্য আনা (Get Shop Profile)
const getShopProfile = async (req, res) => {
  try {
    // সাধারণত মাল্টি-টেনেন্ট সিস্টেমে req.user বা req.shopId থেকে শপের আইডি পাওয়া যায়
    // এখানে উদাহরণস্বরূপ প্রথম শপটি বা নির্দিষ্ট আইডি দিয়ে ফেচ করা হলো
    const shopId = req.params.id || 1; 

    const shop = await prisma.shop.findUnique({
      where: { id: Number(shopId) }
    });

    if (!shop) {
      return res.status(404).json({ success: false, message: "শপ পাওয়া যায়নি!" });
    }

    res.status(200).json({ success: true, data: shop });
  } catch (error) {
    console.error("Error fetching shop profile:", error);
    res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে", error: error.message });
  }
};

// শপের প্রোফাইল আপডেট করা (Update Shop Profile)
const updateShopProfile = async (req, res) => {
  try {
    const shopId = req.params.id || 1;
    const {
      name,
      tagline,
      phone,
      email,
      address,
      tradeLicense,
      binNumber,
      tinNumber,
      bkashMerchant,
      nagadPersonal,
      bankDetails,
      invoiceFooterNote
    } = req.body;

    // যদি নতুন লোগো আপলোড করা হয়, তার পাথ বা URL এখানে রিসিভ হবে
    const logo = req.file ? req.file.path : req.body.logo;

    const updatedShop = await prisma.shop.update({
      where: { id: Number(shopId) },
      data: {
        name,
        tagline,
        phone,
        email,
        address,
        tradeLicense,
        binNumber,
        tinNumber,
        bkashMerchant,
        nagadPersonal,
        bankDetails,
        invoiceFooterNote,
        ...(logo && { logo }) // লোগো থাকলে আপডেট করবে, না থাকলে আগেরটি থাকবে
      }
    });

    res.status(200).json({
      success: true,
      message: "শপ প্রোফাইল সফলভাবে আপডেট করা হয়েছে!",
      data: updatedShop
    });
  } catch (error) {
    console.error("Error updating shop profile:", error);
    res.status(500).json({ success: false, message: "আপডেট করতে সমস্যা হয়েছে", error: error.message });
  }
};

export {
  getShopProfile,
  updateShopProfile
};