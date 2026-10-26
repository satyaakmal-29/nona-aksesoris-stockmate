import { Router } from "express";
import {
  getUsers,
  getProfile,
  updateProfile,
  changeOwnPassword,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from "../controllers/userController";
import { requireAuth, isSuperAdmin } from "../middleware/auth";

const router = Router();

// Semua route user butuh login
router.use(requireAuth);

// Profil — semua role bisa akses profil sendiri
// ("/profile/password" didaftarkan sebelum "/profile/:userId")
router.get("/profile",            getProfile);
router.patch("/profile/password", changeOwnPassword);
router.put("/profile/:userId",    updateProfile);

// Manajemen user — hanya super_admin
router.get("/",                   isSuperAdmin, getUsers);
router.post("/",                  isSuperAdmin, createUser);
router.put("/:userId",            isSuperAdmin, updateUser);
router.patch("/:userId/password", isSuperAdmin, resetUserPassword);
router.delete("/:userId",         isSuperAdmin, deleteUser);

export default router;
