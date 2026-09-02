// customerPayment.routes.js
import express from 'express';
import { protect } from "../middleware/authMiddleware.js";
import { collectPayment, getCustomerPaymentHistory } from '../controllers/CustomerPaymentControl.js';

const router = express.Router();

router.post('/customers/:customerId/collect-payment', protect, collectPayment);
router.get('/customers/:customerId/payments', protect, getCustomerPaymentHistory);

export default router;