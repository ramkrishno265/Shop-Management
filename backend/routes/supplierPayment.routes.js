// supplierPayment.routes.js
import express from 'express';
import { protect } from "../middleware/authMiddleware.js";
import { 
  createSupplierPayment, 
  getSupplierPaymentHistory 
} from '../controllers/supplierPayment.controller.js';

const router = express.Router();

router.post('/suppliers/payments', protect, createSupplierPayment);
router.get('/suppliers/:supplierId/payments', protect, getSupplierPaymentHistory);

export default router;