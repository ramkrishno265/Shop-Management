import express from 'express';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase
} from '../controllers/purchaseController.js';

const router = express.Router();

// Supplier Routes
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// Purchase Routes
router.get('/purchases', getPurchases);
router.post('/purchases', createPurchase);
router.put('/purchases/:id', updatePurchase);
router.delete('/purchases/:id', deletePurchase);

export default router;