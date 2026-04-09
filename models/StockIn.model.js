const mongoose = require("mongoose");

const stockInItemSchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
    },
    partCode:      { type: String, trim: true, default: null },
    partName:      { type: String, required: true, trim: true },
    quantityAdded: { type: Number, required: true, min: 1 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice:  { type: Number, default: 0, min: 0 },
    lineTotal:     { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const stockInSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
    invoiceNo:      { type: String, trim: true, default: "" },
    date:           { type: Date, required: true },
    paymentChannel: { type: String, enum: ["CASH", "CARD", "UPI", "BANK"], default: "CASH" },
    paidAmount:     { type: Number, default: 0, min: 0 },
    totalAmount:    { type: Number, default: 0, min: 0 },
    items:          [stockInItemSchema],
    isDeleted:      { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StockIn", stockInSchema);
