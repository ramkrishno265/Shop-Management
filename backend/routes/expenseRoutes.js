import express from 'express';
import { addExpense, getExpenses } from '../controllers/expenseController.js';
import { verifyToken } from '../middlewares/authMiddleware.js'; // খেয়াল রাখবেন শেষে যেন .js থাকে

const router = express.Router();

router.post('/expenses', verifyToken, addExpense);
router.get('/expenses', verifyToken, getExpenses);

export default router;