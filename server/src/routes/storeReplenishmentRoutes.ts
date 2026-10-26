import { Router } from "express";
import {
  getStoreReplenishments,
  getStoreReplenishmentById,
  createStoreReplenishment,
  approveStoreReplenishment,
  rejectStoreReplenishment,
  shipStoreReplenishment,
  receiveStoreReplenishment,
} from "../controllers/storeReplenishmentController";
import {
  requireAuth,
  isSuperAdmin,
  isAdminGudang,
  isAdminToko,
  isAnyAdmin,
} from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Semua role boleh melihat; Admin Toko dibatasi di controller
// (hanya yang berstatus "shipped" / "completed")
router.get("/",        isAnyAdmin, getStoreReplenishments);
router.get("/:srId",   isAnyAdmin, getStoreReplenishmentById);

router.post("/",                  isSuperAdmin,  createStoreReplenishment);
router.patch("/:srId/approve",    isAdminGudang, approveStoreReplenishment);
router.patch("/:srId/reject",     isAdminGudang, rejectStoreReplenishment);
router.patch("/:srId/ship",       isAdminGudang, shipStoreReplenishment);
router.patch("/:srId/receive",    isAdminToko,   receiveStoreReplenishment);

export default router;