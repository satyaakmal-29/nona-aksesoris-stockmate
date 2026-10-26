import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController";
import { requireAuth, isAnyAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/",             isAnyAdmin, getNotifications);
// "/read-all" harus didaftarkan sebelum "/:notifId", jika tidak
// "read-all" akan dibaca sebagai notifId dan selalu 404.
router.patch("/read-all",   isAnyAdmin, markAllAsRead);
router.patch("/:notifId",   isAnyAdmin, markAsRead);

export default router;