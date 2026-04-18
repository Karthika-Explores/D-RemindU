const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    age: { type: Number, required: true },
    weight: { type: Number, required: true },
    glucoseLevel: { type: Number, required: true },
    emergencyContact: { type: String },
    stockReminderTime: { type: String },
    pushSubscriptions: [{ type: Object }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);