import { Router } from "express";
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  confirmPayment,
  cancelTransaction,
} from "../controllers/transactionController";
import {
  requireAuth,
  requireRole,
  isAdminToko,
  isAnyAdmin,
} from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/",                    isAnyAdmin,   getTransactions);
router.get("/:transactionId",      isAnyAdmin,   getTransactionById);
router.post("/",                   isAdminToko,  createTransaction);

// QRIS: kasir mengonfirmasi dana masuk (stok dikurangi) atau membatalkan
router.post("/:transactionId/confirm-payment", isAdminToko, confirmPayment);
router.post("/:transactionId/cancel", requireRole("admin_toko", "super_admin"), cancelTransaction);

export default router;
