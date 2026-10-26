import { Router } from "express";
import { getDashboardMetrics } from "../controllers/dashboardController";
import { requireAuth, isAnyAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", isAnyAdmin, getDashboardMetrics);

export default router;