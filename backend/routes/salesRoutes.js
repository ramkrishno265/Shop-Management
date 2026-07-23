import express from 'express';
import { createSale } from '../controllers/salesController.js';
// আপনার প্রজেক্টের অথেন্টিকেশন মিডলওয়্যার পাথ এখানে বসাবেন
import { verifyToken } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// POST: /api/sales/create
router.post('/create', verifyToken, createSale);

export default router;