const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const validate = require("../middlewares/validate");
const {
  requestOtpSchema,
  otpVerifySchema,
  garageProfileSchema,
} = require("../validators/user.validator");
const {
  requestOTP,
  verifyOTP,
  resendOTP,
  completeGarageProfile,
  getMyGarage,
  refresh,
  logout,
  uploadImage,
  updatePreferences,
} = require("../controllers/auth.controller");
const protect = require("../middlewares/auth");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are accepted."));
  },
});

// ── Public routes (no auth required) ─────────────────────────────
router.post("/request-otp", validate(requestOtpSchema), requestOTP);
router.post("/resend-otp", validate(requestOtpSchema), resendOTP);
router.post("/verify-otp", validate(otpVerifySchema), verifyOTP);
router.post("/refresh", refresh);

// ── Protected routes ──────────────────────────────────────────────
router.get("/garage", protect, getMyGarage);
router.post(
  "/update-garage-profile",
  protect,
  validate(garageProfileSchema),
  completeGarageProfile,
);
router.post("/logout", protect, logout);
router.post("/upload-image", protect, upload.single("file"), uploadImage);
router.patch("/preferences", protect, updatePreferences);

module.exports = router;
