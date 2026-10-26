import { Router } from "express";
import {
  getSalesReport,
  getStockReport,
} from "../controllers/reportController";
import { requireAuth, isAnyAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/sales", isAnyAdmin, getSalesReport);
router.get("/stock", isAnyAdmin, getStockReport);

export default router;