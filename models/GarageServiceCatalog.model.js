const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────
//  GarageServiceCatalog
//  Master list of services a garage offers (not a job-card entry).
//  Supports generic (all vehicles) or specific brand/model scoping.
// ─────────────────────────────────────────────────────────────────

const garageServiceCatalogSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },

    serviceNo: {
      type: String,
      trim: true,
      default: null,
    },

    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
    },

    category: {
      type: String,
      trim: true,
      default: "Other",
    },

    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    // "generic" → applicable to all vehicles
    // "specific" → only for listed brands / models
    applicability: {
      type: String,
      enum: ["generic", "specific"],
      default: "generic",
    },

    // Applicable vehicle brands (used when applicability === "specific")
    applicableBrands: {
      type: [String],
      default: [],
    },

    // Applicable vehicle models (used when applicability === "specific")
    applicableModels: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

// compound indexes for fast garage-scoped queries
garageServiceCatalogSchema.index({ garageId: 1, isDeleted: 1 });
garageServiceCatalogSchema.index({ garageId: 1, category: 1 });
garageServiceCatalogSchema.index(
  { garageId: 1, serviceNo: 1 },
  { unique: true, sparse: true },
);

garageServiceCatalogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model(
  "GarageServiceCatalog",
  garageServiceCatalogSchema,
);
