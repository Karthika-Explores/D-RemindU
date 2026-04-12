const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String, required: true },
    extractedText: { type: String, required: true },
    confirmedMedicineData: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);