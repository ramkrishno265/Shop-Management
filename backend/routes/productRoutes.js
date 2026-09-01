import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  deleteProduct,
  updateProduct,
  parseProductWithAI,
  bulkImportProducts,
  bulkDeleteProducts
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// routes mapping
router.get("/", protect, getProducts);
router.post("/", protect, createProduct);

// ⚠️ bulk-delete অবশ্যই /:id এর আগে থাকতে হবে (নাহলে "bulk-delete" কে id হিসেবে ধরে ফেলবে)
router.delete("/bulk-delete", protect, bulkDeleteProducts);

router.get("/:id", protect, getProductById);
router.delete("/:id", protect, deleteProduct);
router.put("/:id", protect, updateProduct);

router.post('/ai-parse-product', protect, parseProductWithAI);
router.post('/bulk-import', protect, bulkImportProducts);

export default router;