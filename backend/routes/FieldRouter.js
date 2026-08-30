import express from "express";
import { getShopFields, saveShopFields, deleteShopField } from "../controllers/fieldController.js"; // deleteShopField इम्पोर्ट করা হলো
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

// ফিল্ড রিলেটেড রাউটসমূহ
router.get("/", protect, getShopFields);
router.post("/", protect, saveShopFields);
router.delete("/:fieldId", protect, deleteShopField); // নির্দিষ্ট ফিল্ড আইডি দিয়ে ডিলেট করার রাউট

export default router;