import { Router } from "express";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant,
  addRating,
} from "../controllers/productController";
import { requireAuth, isSuperAdmin, isAnyAdmin } from "../middleware/auth";

const router = Router();

// Semua route produk butuh login
router.use(requireAuth);

// Lihat produk — semua role boleh
router.get("/", isAnyAdmin, getProducts);

// Kelola produk — hanya super_admin
router.post("/",             isSuperAdmin, createProduct);
router.put("/:productId",    isSuperAdmin, updateProduct);
router.delete("/:productId", isSuperAdmin, deleteProduct);

// Kelola varian — hanya super_admin
router.post("/:productId/variants",              isSuperAdmin, addVariant);
router.put("/:productId/variants/:variantId",    isSuperAdmin, updateVariant);
router.delete("/:productId/variants/:variantId", isSuperAdmin, deleteVariant);

// Rating — semua role boleh (dari transaksi penjualan)
router.patch("/:productId/rating", isAnyAdmin, addRating);

export default router;