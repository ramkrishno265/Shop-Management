import express from 'express';
import { getShopProfile, updateShopProfile } from '../controllers/shopProfileController.js';
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// এখানে :id আবশ্যিক, যাতে ফ্রন্টএন্ড থেকে আইডি পাঠানো যায়
router.get('/:id', protect, getShopProfile);
router.put('/:id', protect, updateShopProfile);

export default router;