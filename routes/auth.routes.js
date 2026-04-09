const router = require("express").Router();
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
} = require("../controllers/auth.controller");
const protect = require("../middlewares/auth");

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

module.exports = router;
