import prisma from "../config/db.js";

// Utility: শপ আইডি ভ্যালিডেশন (সিকিউরিটি নিশ্চিত করতে)
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

// ১. নির্দিষ্ট শপের সব কাস্টম ফিল্ড ফেচ করা (GET)
export const getShopFields = async (req, res) => {
  try {
    const requestShopId = req.params.shopId || req.user?.shopId;
    const finalShopId = validateShopAccess(req.user, requestShopId);

    if (!finalShopId) {
      return res.status(403).json({ success: false, message: "Access denied or Invalid Shop ID." });
    }

    const fields = await prisma.shopFieldConfig.findMany({
      where: { shopId: finalShopId, isActive: true }
    });
    
    res.status(200).json({ success: true, data: fields });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ২. নতুন ফিল্ড সেভ বা আপডেট করা (POST / Upsert with Transaction)
export const saveShopFields = async (req, res) => {
  try {
    const requestShopId = req.params.shopId || req.body.requestShopId || req.user?.shopId;
    const finalShopId = validateShopAccess(req.user, requestShopId);

    if (!finalShopId) {
      return res.status(403).json({ success: false, message: "Access denied or Invalid Shop ID." });
    }

    const { fields } = req.body; 
    if (!Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: "Invalid fields format." });
    }

    for (let field of fields) {
      // অপশন ডেটা টাইপ হ্যান্ডেল করা (অ্যারে হলে স্ট্রিং এ রূপান্তর, না হলে ফাঁকা স্ট্রিং)
      let formattedOptions = "";
      if (Array.isArray(field.options)) {
        formattedOptions = field.options.join(", ");
      } else if (typeof field.options === "string") {
        formattedOptions = field.options;
      }

      // ১. চেক করা ফিল্ডটি আগে থেকেই ডাটাবেজে আছে কি না
      const existingField = await prisma.shopFieldConfig.findFirst({
        where: {
          shopId: finalShopId,
          fieldName: field.fieldName
        }
      });

      if (existingField) {
        // যদি থাকে, তবে আপডেট করবে
        await prisma.shopFieldConfig.update({
          where: { id: existingField.id },
          data: {
            fieldLabel: field.fieldLabel,
            fieldType: field.fieldType,
            options: formattedOptions,
            isRequired: field.isRequired,
            isActive: true,
          }
        });
      } else {
        // না থাকলে নতুন তৈরি করবে
        await prisma.shopFieldConfig.create({
          data: {
            shopId: finalShopId,
            fieldName: field.fieldName,
            fieldLabel: field.fieldLabel,
            fieldType: field.fieldType,
            options: formattedOptions,
            isRequired: field.isRequired,
            isActive: true,
          }
        });
      }
    }

    res.status(200).json({ success: true, message: 'Field configurations saved successfully!' });
  } catch (error) {
    console.error("Error saving fields:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};