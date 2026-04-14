const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileUrl: { type: String, required: true },
  extractedText: { type: String },
  isConfirmed: { type: Boolean, default: false }, // For your manual verification step
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Prescription", prescriptionSchema);