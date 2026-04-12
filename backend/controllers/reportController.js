const Log = require("../models/Log");
const Medication = require("../models/Medication");

// 📊 Weekly Adherence Report
exports.getWeeklyReport = async (req, res) => {
  try {
    const userId = req.user;

    // Last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const logs = await Log.find({
      userId,
      date: { $gte: lastWeek }
    });

    let taken = 0;
    let missed = 0;

    logs.forEach((log) => {
      if (log.status === "Taken") taken++;
      if (log.status === "Missed") missed++;
    });

    const total = taken + missed;

    const adherence = total === 0 ? 0 : (taken / total) * 100;

    let message = "";

    if (adherence >= 90) message = "Excellent adherence! Keep it up 💪";
    else if (adherence >= 70) message = "Good job! Stay consistent 👍";
    else message = "Needs improvement. Stay focused ⚠️";

    res.json({
      taken,
      missed,
      adherence: adherence.toFixed(2),
      message
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ⚠️ Low Stock Alert
exports.getLowStock = async (req, res) => {
  try {
    const userId = req.user;

    const medications = await Medication.find({ userId });

    const lowStockMeds = medications.filter(
      (med) => med.totalTablets <= med.lowStockThreshold
    );

    res.json(lowStockMeds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};