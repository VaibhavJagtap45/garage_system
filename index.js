const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const UserRoutes = require("./routes/user.routes");
const { connectDB } = require("./config/dbConnect");
const AuthRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ───────────────────────────────────────────────
app.use(helmet());

// ── Global rate limit — 100 req / 15 min per IP ───────────────────
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ── CORS ───────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// ── Body parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" })); // FormData support
app.use(cookieParser());

// ── Health check ───────────────────────────────────────────────────
app.get("/", (_req, res) =>
  res.json({ message: "Garage System Backend is running 🎉" }),
);

// ── API Routes ─────────────────────────────────────────────────────
const API_VERSION = process.env.BACKEND_VERSION ?? "v1";
app.use(`/api/${API_VERSION}/auth`, AuthRoutes);
app.use(`/api/${API_VERSION}/user`, UserRoutes);
// ── 404 handler ────────────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ success: false, message: "Route not found." }),
);

// ── Global error handler ────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

// ── Bootstrap ──────────────────────────────────────────────────────
connectDB()
  .then(() =>
    app.listen(PORT, () =>
      console.log(`Server running on PORT ${PORT} [${process.env.NODE_ENV}]`),
    ),
  )
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
