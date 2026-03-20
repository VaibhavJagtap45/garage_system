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
  completeGarageProfile,
  refresh,
  logout,
} = require("../controllers/auth.controller");
const protect = require("../middlewares/auth");

router.post("/request-otp", validate(requestOtpSchema), requestOTP);
router.post("/verify-otp", validate(otpVerifySchema), verifyOTP);
router.post(
  "/update-profile",
  protect,
  validate(garageProfileSchema),
  completeGarageProfile,
);
router.post("/refresh", refresh);
router.post("/logout", protect, logout);

module.exports = router;
