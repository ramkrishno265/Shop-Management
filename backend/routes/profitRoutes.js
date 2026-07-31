import express from "express";
import { getProfitReport } from "../controllers/profitController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// শুধুমাত্র লগইন করা User (প্রয়োজনে রোল পাস করতে পারো, যেমন: protect(["ADMIN", "MANAGER"]))
router.get("/", protect, getProfitReport);

export default router;