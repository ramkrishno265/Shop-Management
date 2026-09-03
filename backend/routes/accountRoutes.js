import express from 'express';
import { 
  getAccountsSummary, 
  getAllTransactions, 
  addCapital, 
  addWithdrawal 
} from '../controllers/accountController.js';
import { protect } from '../middleware/authMiddleware.js'; // আপনার অথ মিডলওয়্যার

const router = express.Router();

// অ্যাকাউন্টস সামারি এবং ট্রানজ্যাকশন ফেচ করার রাউট
router.get('/summary', protect, getAccountsSummary);
router.get('/transactions', protect, getAllTransactions);

// নতুন মূলধন ইনভেস্টমেন্ট এবং টাকা উত্তোলন (Withdrawal) সেভ করার রাউট
router.post('/capital', protect, addCapital);
router.post('/withdrawal', protect, addWithdrawal);

export default router;