import express from 'express';
import { createCustomer } from '../controllers/customer.controller.js';
import { protect } from '../middleware/authMiddleware.js';


const router = express.Router();

// POST: /api/customers
router.post('/', protect, createCustomer);

export default router;