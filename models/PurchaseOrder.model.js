const mongoose = require("mongoose");

// ─── Line item inside a purchase order ───────────────────────────
const purchaseOrderItemSchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
    },
    partCode: { type: String, trim: true, default: null },
    partName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ─── Purchase Order ───────────────────────────────────────────────
const purchaseOrderSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },
    orderNo: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Optional link to a repair order / service job
    repairOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RepairOrder",
      default: null,
      index: true,
    },
    items: {
      type: [purchaseOrderItemSchema],
      default: [],
    },
    comments: {
      type: String,
      trim: true,
      default: null,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "sent", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    notifyVendor: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ garageId: 1, status: 1 });
purchaseOrderSchema.index({ garageId: 1, createdAt: -1 });

purchaseOrderSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
