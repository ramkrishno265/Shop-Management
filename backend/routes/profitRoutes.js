import express from "express";
import { getProfitReport } from "../controllers/profitController.js";
import { protect } from "../middleware/authMiddleware.js"; 

const router = express.Router();

router.get(
  "/",
  protect(["ADMIN", "MANAGER"]),
  getProfitReport
);

export default router;