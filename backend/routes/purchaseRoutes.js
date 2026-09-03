import express from 'express';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierDue,
  createSupplierPayment,
  getSupplierPayments,
  deleteSupplierPayment,
  getPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase
} from '../controllers/purchaseController.js';
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// সব রাউটের জন্য প্রটেক্ট মিডলওয়্যার বাধ্যতামূলক করা হলো, 
// যাতে লগইন করা ইউজারের তথ্য (req.user এবং shopId) কন্ট্রোলারে পাওয়া যায়
router.use(protect);

// Supplier Routes
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// Supplier Due / Payment Routes
// ⚠️ NOTE: '/suppliers/:supplierId/due' ও '/suppliers/:supplierId/payments'
// static '/suppliers' রুটের নিচে বসানো হয়েছে যাতে Express route-matching-এ
// কোনো conflict না হয় (Express dynamic segment এমনিতে ঠিকমতোই আলাদা করে,
// কিন্তু ক্রম অনুযায়ী উপরে-নিচে সাজানো readability-র জন্য ভালো)
router.get('/suppliers/:supplierId/due', getSupplierDue);
router.get('/suppliers/:supplierId/payments', getSupplierPayments);
router.post('/supplier-payments', createSupplierPayment);
router.delete('/supplier-payments/:id', deleteSupplierPayment);

// Purchase Routes
router.get('/purchases', getPurchases);
router.post('/purchases', createPurchase);
router.put('/purchases/:id', updatePurchase);
router.delete('/purchases/:id', deletePurchase);

export default router;