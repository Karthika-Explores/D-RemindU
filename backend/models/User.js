const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    age: { type: Number, required: true },
    weight: { type: Number, default: null },
    glucoseLevel: { type: Number, default: null },
    emergencyContact: { type: String, default: "" },
    stockReminderTime: { type: String, default: "09:00" },
    pushSubscriptions: [{ type: Object }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);