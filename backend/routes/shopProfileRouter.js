import express from 'express';
import { getShopProfile, updateShopProfile } from '../controllers/shopProfileController.js';
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// শপের তথ্য দেখার রাউট
router.get('/:id', protect, getShopProfile);

// শপের তথ্য আপডেট করার রাউট
router.put('/:id', protect, updateShopProfile);

// ES Module নিয়মে এক্সপোর্ট
export default router;