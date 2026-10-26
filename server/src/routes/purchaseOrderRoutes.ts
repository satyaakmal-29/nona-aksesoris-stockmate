import { Router } from "express";
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  receivePurchaseOrder,
} from "../controllers/purchaseOrderController";
import {
  requireAuth,
  isSuperAdmin,
  isAdminGudang,
  isAdminGudangOrSuper,
} from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Super Admin & Admin Gudang boleh melihat (Admin Toko tidak)
router.get("/",        isAdminGudangOrSuper, getPurchaseOrders);
router.get("/:poId",   isAdminGudangOrSuper, getPurchaseOrderById);

// Super Admin membuat PO; Admin Gudang memvalidasi penerimaan
router.post("/",               isSuperAdmin,  createPurchaseOrder);
router.patch("/:poId/receive", isAdminGudang, receivePurchaseOrder);

export default router;