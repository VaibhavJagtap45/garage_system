const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    partName: {
      type: String,
      required: true,
      trim: true,
    },

    partCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    category: {
      type: String,
      trim: true,
      required: true,
      default: "general",
      index: true,
    },

    brand: {
      type: String,
      trim: true,
      default: null,
    },

    manufacturer: {
      type: String,
      trim: true,
      default: null,
    },

    unit: {
      type: String,
      trim: true,
      default: "pcs",
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    quantityInHand: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    minimumStockLevel: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },

    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    taxPercent: {
      type: Number,
      default: 0,
      min: 0,
    },

    storageLocation: {
      type: String,
      trim: true,
      default: null,
    },

    isConsumable: {
      type: Boolean,
      default: true,
    },

    manageInventory: {
      type: Boolean,
      default: true,
    },

    applicability: {
      type: String,
      enum: ["generic", "specific"],
      default: "generic",
      index: true,
    },

    applicableBrands: [{ type: String, trim: true }],
    applicableModels: [{ type: String, trim: true }],

    isActive: {
      type: Boolean,
      default: true,
    },

    lastPurchasedAt: {
      type: Date,
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

inventorySchema.index({ garageId: 1, partName: 1 });
inventorySchema.index({ garageId: 1, partCode: 1 }, { unique: false });
inventorySchema.index({ garageId: 1, applicability: 1, category: 1 });

// inventorySchema.pre("save", function (next) {
//   if (this.partCode) {
//     this.partCode = this.partCode.trim().toUpperCase();
//   }
//   next();
// });

inventorySchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Inventory", inventorySchema);
