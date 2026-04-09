const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["rent", "salary", "utilities", "repairs", "fuel", "food", "misc", "other"],
      default: "misc",
    },
    description: { type: String, trim: true, default: "" },
    amount:       { type: Number, required: true, min: 0 },
    date:         { type: Date, required: true },
    paymentMethod:{
      type: String,
      enum: ["CASH", "CARD", "UPI", "BANK", "OTHER"],
      default: "CASH",
    },
    notes:      { type: String, trim: true, default: "" },
    paidStatus: {
      type: String,
      enum: ["paid", "credit"],
      default: "paid",
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Expense", expenseSchema);
