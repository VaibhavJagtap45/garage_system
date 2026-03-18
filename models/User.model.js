const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    emailId: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phoneNo: { type: String, unique: true, sparse: true },
    isVerified: { type: Boolean, default: false },
    role: {
      type: String,
      required: true,
      enum: ["owner", "customer", "member", "vendor"],
      default: "owner",
    },
    state: { type: String, trim: true },

    // Garage info — only relevant for role: "owner"
    garageName: { type: String, trim: true },
    garageOwnerName: { type: String, trim: true },
    garageAddress: { type: String, trim: true },
    garageContactNumber: { type: String, unique: true, sparse: true },
    garageType: { type: String, enum: ["twoWheeler", "fourWheeler"] },
    garageLogo: {
      type: String,
      validate: {
        validator: (v) => !v || /^https?:\/\/.+/.test(v),
        message: "garageLogo must be a valid URL",
      },
    },

    // GST
    isGstApplicable: { type: Boolean, default: false },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      validate: {
        validator: (v) =>
          !v ||
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
        message: "Invalid GST number format",
      },
    },

    // OTP
    otp: {
      code: { type: String },
      expiresAt: { type: Date },
      attempts: { type: Number, default: 0, max: 5 },
    },
    refreshToken: {
      token: { type: String },
      expiresAt: { type: Date },
    },
  },
  { timestamps: true },
);

// Enforce owner-required fields
UserSchema.pre("validate", function (next) {
  if (this.role === "owner") {
    if (!this.garageName) this.invalidate("garageName", "Required for owner");
    if (!this.garageAddress)
      this.invalidate("garageAddress", "Required for owner");
    if (!this.garageContactNumber)
      this.invalidate("garageContactNumber", "Required for owner");
  }
  next();
});

// Clear GST number if not applicable
UserSchema.pre("save", function (next) {
  if (!this.isGstApplicable) this.gstNumber = null;
  next();
});

// Strip sensitive / irrelevant fields from responses
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.otp;
  delete obj.refreshToken;
  delete obj.__v;
  if (this.role !== "owner") {
    [
      "garageName",
      "garageOwnerName",
      "garageAddress",
      "garageType",
      "garageLogo",
      "garageContactNumber",
      "isGstApplicable",
      "gstNumber",
    ].forEach((f) => delete obj[f]);
  }
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
