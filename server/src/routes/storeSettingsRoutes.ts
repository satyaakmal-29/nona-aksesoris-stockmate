import { Router } from "express";
import { getStoreSettings, updateStoreSettings } from "../controllers/storeSettingsController";
import { requireAuth, isAnyAdmin, isSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Semua peran membaca (nama toko untuk struk, status QRIS); hanya Super Admin mengubah
router.get("/store", isAnyAdmin,   getStoreSettings);
router.put("/store", isSuperAdmin, updateStoreSettings);

export default router;
