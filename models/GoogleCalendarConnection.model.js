const mongoose = require("mongoose");

const encryptedTokenSchema = new mongoose.Schema(
  {
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    data: { type: String, required: true },
    alg: { type: String, default: "aes-256-gcm" },
  },
  { _id: false },
);

const GoogleCalendarConnectionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    garage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },
    calendarId: {
      type: String,
      trim: true,
      default: "primary",
    },
    refreshToken: {
      type: encryptedTokenSchema,
      default: null,
      select: false,
    },
    scope: {
      type: String,
      trim: true,
      default: "",
    },
    tokenType: {
      type: String,
      trim: true,
      default: "Bearer",
    },
    accessTokenExpiresAt: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    disconnectedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

GoogleCalendarConnectionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.refreshToken;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model(
  "GoogleCalendarConnection",
  GoogleCalendarConnectionSchema,
);
