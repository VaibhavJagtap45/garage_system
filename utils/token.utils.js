// utils/token.utils.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User.model");

// ─── Constants ────────────────────────────────────────────
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Sign Access Token ────────────────────────────────────
const signAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user._id,
      role: user.role,
      phoneNo: user.phoneNo,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
};

// ─── Sign Refresh Token ───────────────────────────────────
const signRefreshToken = (user) => {
  return jwt.sign({ sub: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
};

// ─── Verify Access Token ──────────────────────────────────
const verifyAccessToken = (token) => {
  try {
    return {
      valid: true,
      expired: false,
      decoded: jwt.verify(token, process.env.JWT_ACCESS_SECRET),
    };
  } catch (err) {
    return {
      valid: false,
      expired: err.name === "TokenExpiredError",
      decoded: null,
    };
  }
};

// ─── Verify Refresh Token ─────────────────────────────────
const verifyRefreshToken = (token) => {
  try {
    return {
      valid: true,
      expired: false,
      decoded: jwt.verify(token, process.env.JWT_REFRESH_SECRET),
    };
  } catch (err) {
    return {
      valid: false,
      expired: err.name === "TokenExpiredError",
      decoded: null,
    };
  }
};

// ─── Generate & Save Refresh Token to DB ─────────────────
const generateAndSaveRefreshToken = async (user) => {
  const refreshToken = signRefreshToken(user);

  // Hash before storing — never store raw token in DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  await User.findByIdAndUpdate(user._id, {
    refreshToken: {
      token: hashedToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  });

  return refreshToken; // return raw token to send to client
};

// ─── Rotate Refresh Token ─────────────────────────────────
// Invalidates old token and issues a new pair
const rotateRefreshToken = async (incomingToken) => {
  const { valid, expired, decoded } = verifyRefreshToken(incomingToken);

  if (!valid) {
    return {
      success: false,
      message: expired
        ? "Refresh token expired. Please login again."
        : "Invalid refresh token.",
    };
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.refreshToken?.token) {
    return { success: false, message: "User not found or not logged in." };
  }

  // Compare hashed incoming token against stored hash
  const hashedIncoming = crypto
    .createHash("sha256")
    .update(incomingToken)
    .digest("hex");

  if (hashedIncoming !== user.refreshToken.token) {
    // Token reuse detected — possible theft, invalidate everything
    await User.findByIdAndUpdate(decoded.sub, {
      $unset: { refreshToken: "" },
    });
    return {
      success: false,
      message: "Token reuse detected. Please login again.",
    };
  }

  // Check DB-level expiry as second layer
  if (new Date() > user.refreshToken.expiresAt) {
    return {
      success: false,
      message: "Refresh token expired. Please login again.",
    };
  }

  // Issue new tokens
  const newAccessToken = signAccessToken(user);
  const newRefreshToken = await generateAndSaveRefreshToken(user);

  return {
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ─── Revoke Refresh Token (logout) ───────────────────────
const revokeRefreshToken = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $unset: { refreshToken: "" },
  });
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateAndSaveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
};
