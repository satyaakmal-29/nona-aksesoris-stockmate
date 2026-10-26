import { Router } from "express";
import {
  getStockGudang,
  getStockToko,
  getStockMovements,
} from "../controllers/inventoryController";
import {
  requireAuth,
  isAnyAdmin,
  isAdminGudangOrSuper,
} from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Stok gudang — super_admin & admin_gudang saja
router.get("/gudang",    isAdminGudangOrSuper, getStockGudang);

// Stok toko — semua role boleh lihat
router.get("/toko",      isAnyAdmin, getStockToko);

// Riwayat pergerakan stok — semua role boleh lihat
router.get("/movements", isAnyAdmin, getStockMovements);

export default router;