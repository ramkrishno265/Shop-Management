import express from 'express';
import { addExpense, getExpenses } from '../controllers/expenseController.js';
import { verifyToken } from '../middlewares/authMiddleware.js'; // আপনার প্রজেক্টের অথেন্টিকেশন মিডলওয়্যার পাথ অনুযায়ী ঠিক করে দেবেন

const router = express.Router();

// নতুন খরচ যোগ করার রুট
router.post('/expenses', verifyToken, addExpense);

// নির্দিষ্ট শপের খরচের তালিকা ও মোট খরচ দেখার রুট
router.get('/expenses', verifyToken, getExpenses);

export default router;