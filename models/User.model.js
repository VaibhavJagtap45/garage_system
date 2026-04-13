const mongoose = require("mongoose");
//  User Schema
const UserSchema = new mongoose.Schema(
  {
    garage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      default: null,
      index: true,
    },
    // ── Identity ──────────────────────────────────────────────────
    fullName: {
      type: String,
      trim: true,
      default: null,
    },
    emailId: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      // No default — field must be absent (not null) for sparse index to exclude it.
      // Storing null counts as a value and breaks the unique constraint for phone-only users.
    },
    phoneNo: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ── Auth / Access Control ─────────────────────────────────────
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: ["owner", "customer", "member", "vendor"],
        message: "Invalid role",
      },
      default: "owner",
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },

    // ── OTP (transient — cleared after verification) ───────────────
    otp: {
      code: { type: String },
      expiresAt: { type: Date },
      attempts: { type: Number, default: 0, max: 5 },
    },

    // ── Refresh Token (hashed) ────────────────────────────────────
    refreshToken: {
      token: { type: String },
      expiresAt: { type: Date },
    },

    // ── Expo Push Token ───────────────────────────────────────────
    // Stored as-is from the device (e.g. "ExponentPushToken[xxx]").
    // Cleared automatically when Expo reports DeviceNotRegistered.
    pushToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ── Strip sensitive fields from API responses ─────────────────────
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.otp;
  delete obj.refreshToken;
  delete obj.pushToken; // device token — must never leak to API consumers
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
