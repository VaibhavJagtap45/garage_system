const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────
//  VehicleMeta Schema
//  Stores master list of brands and their models independently
//  of actual vehicle records — used for frontend dropdowns.
// ─────────────────────────────────────────────────────────────────
const VehicleMetaSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    models: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true },
);

VehicleMetaSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("VehicleMeta", VehicleMetaSchema);
