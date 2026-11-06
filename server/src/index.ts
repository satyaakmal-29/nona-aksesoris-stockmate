import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import session from "express-session";

import dashboardRoutes          from "./routes/dashboardRoutes";
import productRoutes            from "./routes/productRoutes";
import userRoutes               from "./routes/userRoutes";
import expenseRoutes            from "./routes/expenseRoutes";
import authRoutes               from "./routes/authRoutes";
import purchaseOrderRoutes      from "./routes/purchaseOrderRoutes";      // pembelian ke supplier
import storeReplenishmentRoutes from "./routes/storeReplenishmentRoutes"; // gudang → toko
import transactionRoutes        from "./routes/transactionRoutes";
import notificationRoutes       from "./routes/notificationRoutes";
import inventoryRoutes          from "./routes/inventoryRoutes";
import reportRoutes             from "./routes/reportRoutes";
import storeSettingsRoutes      from "./routes/storeSettingsRoutes";      // QRIS & identitas toko
import { resetInterruptedReceiptEmails } from "./controllers/transactionController";

dotenv.config();
const app = express();

// Batas 10 MB: foto nota / surat jalan dikirim sebagai data URL (sudah dikompres di klien)
const BODY_LIMIT = "10mb";

app.use(express.json({ limit: BODY_LIMIT }));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

app.use(
  cors({
    origin:      process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(
  session({
    name:   "stockmate.sid",
    secret: process.env.SESSION_SECRET || "ganti-dengan-secret-yang-kuat",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      // Sesi berakhir 18 jam setelah login (tidak diperpanjang otomatis; rolling = false)
      maxAge:   18 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use("/assets", express.static(path.join(__dirname, "../assets")));

// ── ROUTES ────────────────────────────────────────────────────────
app.use("/auth",                authRoutes);                // public
app.use("/dashboard",           dashboardRoutes);
app.use("/products",            productRoutes);
app.use("/users",               userRoutes);
app.use("/expenses",            expenseRoutes);
app.use("/inventory",           inventoryRoutes);
app.use("/purchase-orders",     purchaseOrderRoutes);       // supplier (Super Admin → Admin Gudang validasi)
app.use("/store-replenishments", storeReplenishmentRoutes); // gudang → toko
app.use("/transactions",        transactionRoutes);
app.use("/notifications",       notificationRoutes);
app.use("/reports",             reportRoutes);
app.use("/settings",            storeSettingsRoutes);

app.get("/", (_req, res) => {
  res.send("Welcome to StockMate API v2");
});

// Gambar terlalu besar → pesan yang jelas, bukan HTML error bawaan
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({
      message: "Ukuran data terlalu besar. Gunakan foto dengan ukuran lebih kecil.",
    });
    return;
  }
  next(err);
});

const port = Number(process.env.PORT) || 8000;
// Tanpa host: Node mendengarkan IPv6 + IPv4 sekaligus (termasuk LAN). Jika hanya
// "0.0.0.0", "localhost" di Windows dicoba lewat ::1 dulu → tiap koneksi baru +±200 ms.
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  void resetInterruptedReceiptEmails();
});