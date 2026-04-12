const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medicineName: { type: String, required: true },
    dosage: { type: String, required: true },
    instructions: { type: String, required: true },
    reminderTime: { type: String, required: true }, // HH:MM
    totalTablets: { type: Number, required: true, default: 0 },
    tabletsPerDose: { type: Number, required: true, default: 1 },
    dosesPerDay: { type: Number, required: true, default: 1 },
    lowStockThreshold: { type: Number, required: true, default: 5 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Medication", medicationSchema);