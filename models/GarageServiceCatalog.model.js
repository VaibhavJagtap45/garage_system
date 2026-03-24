const mongoose = require("mongoose");

const garageServiceCatalogSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    itemType: {
      type: String,
      enum: ["service", "part"],
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    no: {
      type: String,
      trim: true,
      default: "",
    },

    serviceCategory: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },

    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    manageInventory: {
      type: Boolean,
      default: false,
    },

    applicability: {
      type: String,
      enum: ["generic", "specific"],
      default: "generic",
    },

    applicableBrands: [{ type: String, trim: true }],
    applicableModels: [{ type: String, trim: true }],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

garageServiceCatalogSchema.index({
  garageId: 1,
  itemType: 1,
  isActive: 1,
  category: 1,
});

garageServiceCatalogSchema.index({
  garageId: 1,
  itemType: 1,
  name: 1,
});

garageServiceCatalogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("GarageServiceCatalog", garageServiceCatalogSchema);
