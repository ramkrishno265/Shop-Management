import prisma from "../config/db.js";

// Utility: শপ আইডি ভ্যালিডেশন (আপনার প্রোডাক্ট কন্ট্রোলারের মতোই)
const validateShopAccess = (user, requestShopId) => {
  const userShopId = user?.shopId ? Number(user.shopId) : null;
  const targetShopId = requestShopId ? Number(requestShopId) : userShopId;

  if (!targetShopId) return null;

  // ADMIN সব শপ অ্যাক্সেস করতে পারবে, অন্যরা শুধু তাদের নিজস্ব শপ
  if (user?.role !== "ADMIN" && targetShopId !== userShopId) {
    return null;
  }
  return targetShopId;
};

// শপের প্রোফাইল তথ্য আনা (Get Shop Profile)
export const getShopProfile = async (req, res) => {
  try {
    // req.user থেকে অথবা params থেকে শপ আইডি সুরক্ষিতভাবে নেওয়া
    const requestShopId = req.params.id || req.user?.shopId;
    const finalShopId = validateShopAccess(req.user, requestShopId);

    if (!finalShopId) {
      return res.status(403).json({ success: false, message: "Access denied or Invalid Shop ID." });
    }

    const shop = await prisma.shop.findUnique({
      where: { id: finalShopId },
      include: {
        fieldConfigs: { // যদি শপের কাস্টম ফিল্ডগুলো একসাথে দেখতে চান
          where: { isActive: true }
        }
      }
    });

    if (!shop) {
      return res.status(404).json({ success: false, message: "শপ পাওয়া যায়নি!" });
    }

    res.status(200).json({ success: true, data: shop });
  } catch (error) {
    console.error("Error fetching shop profile:", error);
    res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে", error: error.message });
  }
};

// শপের প্রোফাইল আপডেট করা (Update Shop Profile)
export const updateShopProfile = async (req, res) => {
  try {
    const requestShopId = req.params.id || req.body.requestShopId || req.user?.shopId;
    const finalShopId = validateShopAccess(req.user, requestShopId);

    if (!finalShopId) {
      return res.status(403).json({ success: false, message: "Access denied or Invalid Shop ID." });
    }

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

    // যদি নতুন লোগো আপলোড করা হয়, তার পাথ বা URL এখানে রিসিভ হবে
    const logo = req.file ? req.file.path : req.body.logo;

    const updatedShop = await prisma.shop.update({
      where: { id: finalShopId },
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
      message: "শপ প্রোফাইল সফলভাবে আপডেট করা হয়েছে!",
      data: updatedShop
    });
  } catch (error) {
    console.error("Error updating shop profile:", error);
    res.status(500).json({ success: false, message: "আপডেট করতে সমস্যা হয়েছে", error: error.message });
  }
};

// কাস্টম ফিল্ড কনফিগারেশন সেভ বা আপডেট করার জন্য (যদি প্রয়োজন হয়)
export const saveShopFields = async (req, res) => {
  try {
    const finalShopId = validateShopAccess(req.user, req.body.requestShopId || req.params.shopId);
    if (!finalShopId) return res.status(403).json({ success: false, message: "Access denied or Invalid Shop ID." });

    const { fields } = req.body; 
    if (!Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: "Invalid fields format." });
    }

    for (let field of fields) {
      await prisma.shopFieldConfig.upsert({
        where: {
          shopId_fieldName: {
            shopId: finalShopId,
            fieldName: field.fieldName
          }
        },
        update: {
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          options: field.options,
          isRequired: field.isRequired,
        },
        create: {
          shopId: finalShopId,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          options: field.options,
          isRequired: field.isRequired,
        }
      });
    }

    res.status(200).json({ success: true, message: 'Field configurations saved successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};