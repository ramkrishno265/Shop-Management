import express from 'express';
import { addExpense, getExpenses } from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js'; // খেয়াল রাখবেন শেষে যেন .js থাকে

const router = express.Router();

router.post('/expenses', protect, addExpense);
router.get('/expenses', protect, getExpenses);

export default router;