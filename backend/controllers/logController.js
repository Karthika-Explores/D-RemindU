const Log = require("../models/Log");
const Medication = require("../models/Medication");

// ✅ Mark as Taken
exports.markTaken = async (req, res) => {
  try {
    const { medicationId } = req.body;

    const medication = await Medication.findById(medicationId);

    if (!medication) {
      return res.status(404).json({ message: "Medication not found" });
    }

    if (medication.userId.toString() !== req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // 🧠 Reduce tablets
    const tabletsToReduce = medication.tabletsPerDose;

    medication.totalTablets = Math.max(
      0,
      medication.totalTablets - tabletsToReduce
    );

    await medication.save();

    // 📝 Create log
    const log = await Log.create({
      userId: req.user,
      medicationId,
      status: "Taken"
    });

    res.json({
      message: "Medication marked as taken",
      remainingTablets: medication.totalTablets,
      log
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ❌ Mark as Missed
exports.markMissed = async (req, res) => {
  try {
    const { medicationId } = req.body;

    const medication = await Medication.findById(medicationId);

    if (!medication) {
      return res.status(404).json({ message: "Medication not found" });
    }

    if (medication.userId.toString() !== req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const log = await Log.create({
      userId: req.user,
      medicationId,
      status: "Missed"
    });

    res.json({
      message: "Medication marked as missed",
      log
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};