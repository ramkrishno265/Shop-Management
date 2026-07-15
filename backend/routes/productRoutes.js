import express from "express";
import { 
  getProducts, 
  createProduct, 
  deleteProduct 
} from "../controllers/productController.js"; 

const router = express.Router();

// routes mapping
router.get("/", getProducts);
router.post("/", createProduct);
router.delete("/:id", deleteProduct);

// এই লাইনটি নিশ্চিত করো (export default থাকতে হবে)
export default router;