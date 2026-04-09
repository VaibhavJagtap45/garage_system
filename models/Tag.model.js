const mongoose = require("mongoose");

const TagSchema = new mongoose.Schema(
  {
    garageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    color: { type: String, default: "#111111", trim: true }, // hex color
    tagType: {
      type: String,
      enum: ["invoice", "repair_order", "both"],
      default: "both",
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TagSchema.index({ garageId: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = mongoose.model("Tag", TagSchema);
