import express from 'express';
import { createSale } from '../controllers/salesController.js';
// আপনার প্রজেক্টের অথেন্টিকেশন মিডলওয়্যার পাথ এখানে বসাবেন
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST: /api/sales/create
router.post('/create', protect, createSale);

export default router;