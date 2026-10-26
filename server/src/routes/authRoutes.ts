import express from "express";
import {
  login,
  logout,
  me,
  initSuperAdmin,
  checkSetup,
} from "../controllers/authController";

const router = express.Router();

router.get("/check-setup", checkSetup); // cek apakah DB sudah ada user
router.post("/init", initSuperAdmin);   // setup pertama kali
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", me);

export default router;