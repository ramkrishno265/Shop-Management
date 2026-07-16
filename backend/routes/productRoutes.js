import express from "express";
import { 
  getProducts, 
  createProduct, 
  deleteProduct 
} from "../controllers/productController.js"; 
import { protect } from "../middleware/authMiddleware.js"; // 👈 মিডলওয়্যারটি ইমপোর্ট করো

const router = express.Router();

// routes mapping (সবগুলো রাউটের মাঝখানে 'protect' বসিয়ে সিকিউর করা হলো)
router.get("/", protect, getProducts);
router.post("/", protect, createProduct);
router.delete("/:id", protect, deleteProduct);

// এই লাইনটি নিশ্চিত করো (export default থাকতে হবে)
export default router;