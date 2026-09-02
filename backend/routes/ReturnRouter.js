import express from "express";
import {
  findSaleForReturn,
  createCustomerReturn,
  createPurchaseReturn,
  getCustomerReturns,
  getPurchaseReturns
} from "../controllers/ReturnController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ইনভয়েস সার্চ (GET /api/returns/find-sale?query=...&shopId=...)
router.get("/find-sale", protect, findSaleForReturn);

// কাস্টমার রিটার্ন রাউটস
router.post("/customer", protect, createCustomerReturn);
router.get("/customer/:shopId", protect, getCustomerReturns);

// সাপ্লায়ার রিটার্ন রাউটস
router.post("/purchase", protect, createPurchaseReturn);
router.get("/purchase/:shopId", protect, getPurchaseReturns);

export default router;