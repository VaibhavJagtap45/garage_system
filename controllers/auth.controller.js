const {
  generateOTP,
  OTP_EXPIRY_MINUTES,
  sendOTP,
  hashOTP,
} = require("../services/otp.service");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const {
  signAccessToken,
  generateAndSaveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} = require("../utils/token.utils");
const { sendSuccess, sendError } = require("../utils/response.utils");

// ─── Cookie config — defined once, reused everywhere ──────
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── Step 1: Request OTP ──────────────────────────────────
const requestOTP = asyncHandler(async (req, res) => {
  const { phoneNo } = req.body;

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await User.findOneAndUpdate(
    { phoneNo },
    { otp: { code: hashOTP(otp), expiresAt, attempts: 0 } },
    { upsert: true, returnDocument: "after" },
  );

  await sendOTP(phoneNo, otp);

  return sendSuccess(res, 200, "OTP sent successfully", otp);
});

// ─── Step 2: Verify OTP ───────────────────────────────────
const verifyOTP = asyncHandler(async (req, res) => {
  const { phoneNo, otp } = req.body;

  const user = await User.findOne({ phoneNo });

  if (!user || !user.otp?.code)
    return sendError(res, 404, "No OTP found. Request a new one.");

  if (user.otp.attempts >= 3)
    return sendError(res, 429, "Too many attempts. Request a new OTP.");

  if (new Date() > user.otp.expiresAt)
    return sendError(res, 400, "OTP expired. Request a new one.");

  if (user.otp.code !== hashOTP(otp)) {
    await User.updateOne({ phoneNo }, { $inc: { "otp.attempts": 1 } });
    return sendError(res, 400, "Invalid OTP");
  }

  await User.updateOne({ phoneNo }, { isVerified: true, $unset: { otp: "" } });

  const accessToken = signAccessToken(user);
  const refreshToken = await generateAndSaveRefreshToken(user);

  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  return sendSuccess(res, 200, "Mobile verified successfully", { accessToken });
});

// ─── Step 3: Resend OTP ───────────────────────────────────
const resendOTP = asyncHandler(async (req, res) => {
  const { phoneNo } = req.body;

  const user = await User.findOne({ phoneNo });
  if (!user)
    return sendError(
      res,
      404,
      "No account found with this number. Request OTP first.",
    );

  if (user.isVerified)
    return sendError(res, 400, "This number is already verified.");

  if (user.otp?.expiresAt) {
    const otpLifetimeMs = OTP_EXPIRY_MINUTES * 60 * 1000;
    const otpCreatedAt = new Date(user.otp.expiresAt).getTime() - otpLifetimeMs;
    const secondsSinceSent = (Date.now() - otpCreatedAt) / 1000;

    if (secondsSinceSent < 60) {
      const waitSeconds = Math.ceil(60 - secondsSinceSent);
      return sendError(
        res,
        429,
        `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
      );
    }
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await User.updateOne(
    { phoneNo },
    { otp: { code: hashOTP(otp), expiresAt, attempts: 0 } },
  );
  await sendOTP(phoneNo, otp);
  return sendSuccess(res, 200, "OTP resent successfully", otp);
});

// ─── Step 4: Complete Garage Profile ─────────────────────
const completeGarageProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (req.user.role !== "owner")
    return sendError(res, 403, "Only owners can set garage details");

  const {
    fullName,
    emailId,
    garageName,
    garageOwnerName,
    garageAddress,
    garageContactNumber,
    garageType,
    garageLogo,
    state,
    isGstApplicable,
    gstNumber,
  } = req.body;

  const updated = await User.findByIdAndUpdate(
    userId,
    {
      fullName,
      emailId,
      garageName,
      garageOwnerName,
      garageAddress,
      garageContactNumber,
      garageType,
      garageLogo,
      state,
      isGstApplicable,
      gstNumber: isGstApplicable ? gstNumber : null,
    },
    { returnDocument: "after", runValidators: true },
  );

  return sendSuccess(res, 200, "Garage profile completed", { user: updated });
});

// ─── Refresh Token ────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken;

  if (!incomingToken) return sendError(res, 401, "No refresh token.");

  const result = await rotateRefreshToken(incomingToken);

  if (!result.success) return sendError(res, 401, result.message);

  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return sendSuccess(res, 200, "Token refreshed", {
    accessToken: result.accessToken,
  });
});

// ─── Logout ───────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await revokeRefreshToken(req.user._id);
  res.clearCookie("refreshToken");
  return sendSuccess(res, 200, "Logged out successfully");
});

module.exports = {
  requestOTP,
  verifyOTP,
  resendOTP,
  completeGarageProfile,
  refresh,
  logout,
};
