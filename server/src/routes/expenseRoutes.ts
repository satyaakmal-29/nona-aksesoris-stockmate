import { Router } from "express";
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController";
import { requireAuth, isSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Pengeluaran hanya untuk Super Admin (Tabel Wewenang)
router.get("/",              isSuperAdmin, getExpenses);
router.get("/:expenseId",    isSuperAdmin, getExpenseById);
router.post("/",             isSuperAdmin, createExpense);
router.put("/:expenseId",    isSuperAdmin, updateExpense);
router.delete("/:expenseId", isSuperAdmin, deleteExpense);

export default router;
