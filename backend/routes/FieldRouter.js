import express from "express";
import { getShopFields, saveShopFields } from "../controllers/fieldController.js"; // অথবা আপনার ফিল্ড কন্ট্রোলারের পাথ
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

// ফিল্ড রিলেটেড রাউটসমূহ
router.get("/", protect, getShopFields);
router.post("/", protect, saveShopFields);

export default router;