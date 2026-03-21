const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────
//  User Schema
//  Holds auth-level data only.  Garage business details live in the
//  separate Garage model (see models/Garage.model.js).
// ─────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
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
      default: null,
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
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
