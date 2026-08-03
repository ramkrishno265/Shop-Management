import express from "express";
import {
  getProducts,
  getProductById, // 👈 নতুন কন্ট্রোলারটি ইমপোর্ট করুন
  createProduct,
  deleteProduct,
  updateProduct
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// routes mapping
router.get("/", protect, getProducts);
router.get("/:id", protect, getProductById); // 👈 এই লাইনটি যোগ করুন (সিঙ্গেল প্রোডাক্ট আনার জন্য)
router.post("/", protect, createProduct);
router.delete("/:id", protect, deleteProduct);
router.put("/:id", protect, updateProduct);

export default router;