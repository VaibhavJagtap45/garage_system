const dotenv = require("dotenv");
dotenv.config();
const AuthRoutes = require("./routes/auth.routes");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { connectDB } = require("./config/dbConnect");

const app = express();
const PORT = process.env.PORT || 5000;

// Security
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Parsers
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Routes
app.get("/", (req, res) =>
  res.json({ message: "Garage System Backend is running 🎉" }),
);
const BACKEND_VERSION = process.env.BACKEND_VERSION;

app.use(`/api/${BACKEND_VERSION}/auth`, AuthRoutes);

// Global error handler (must be last)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Internal Server Error" });
});

// Start only after DB connects
connectDB()
  .then(() =>
    app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`)),
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
