import express from 'express';
import { createCustomer, getCustomersByShop } from '../controllers/customer.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST: /api/customers (নতুন কাস্টমার তৈরি করতে)
router.post('/', protect, createCustomer);

// GET: /api/customers?shopId=1 (নির্দিষ্ট শপের কাস্টমার লিস্ট পেতে)
router.get('/', protect, getCustomersByShop);

export default router;