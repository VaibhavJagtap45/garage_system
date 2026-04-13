const mongoose = require("mongoose");
// ─────────────────────────────────────────────────────────────────
//  Garage Schema
const GarageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ── Core Garage Details ───────────────────────────────────────
    garageName: {
      type: String,
      required: [true, "Garage name is required"],
      trim: true,
    },
    garageOwnerName: {
      type: String,
      required: [true, "Garage owner name is required"],
      trim: true,
    },
    garageAddress: {
      type: String,
      required: [true, "Garage address is required"],
      trim: true,
    },
    garageContactNumber: {
      type: String,
      required: [true, "Garage contact number is required"],
      unique: true,
      sparse: true,
    },
    garageType: {
      type: String,
      required: [true, "Garage type is required"],
      enum: {
        values: ["twoWheeler", "fourWheeler", "both"],
        message: "garageType must be twoWheeler or fourWheeler",
      },
    },
    garageLogo: {
      type: String,
      default: null,
      validate: {
        validator: (v) => !v || /^https?:\/\/.+/.test(v) || /^data:image\/.+;base64,/.test(v),
        message: "garageLogo must be a valid URL or base64 data URI",
      },
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },

    // ── GST Details ───────────────────────────────────────────────
    isGstApplicable: {
      type: Boolean,
      default: false,
    },
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

    // ── Profile completeness flag ─────────────────────────────────
    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    // ── Admin approval status ─────────────────────────────────────
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // ── App Preferences ───────────────────────────────────────────
    preferences: {
      notificationsEnabled:  { type: Boolean, default: true },
      autoUpdates:           { type: Boolean, default: true },
      autoWaNotification:    { type: Boolean, default: false },
      fontSize:              { type: String, enum: ["small", "medium", "large"], default: "medium" },
    },
  },
  {
    timestamps: true,
  },
);

// ── Auto-clear GST number when not applicable ─────────────────────
GarageSchema.pre("save", async function () {
  if (!this.isGstApplicable) this.gstNumber = null;
});

// ── Strip internal fields from API responses ──────────────────────
GarageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Garage", GarageSchema);
