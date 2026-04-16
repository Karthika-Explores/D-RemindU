const Medication = require("../models/Medication");

exports.addMedication = async (req, res) => {
  try {
    // ✅ Updated to match the fields sent by your Dashboard/OCR
    const { 
      medicineName, 
      dosage, 
      instructions, 
      reminderTime, 
      totalTablets, 
      tabletsPerDose, 
      dosesPerDay, 
      lowStockThreshold,
      injectionSite,
      mealTiming
    } = req.body;

    const newMed = new Medication({
      userId: req.user.id || req.user._id || req.user,
      medicineName,
      dosage,
      instructions,
      reminderTime,
      injectionSite,
      mealTiming,
      totalTablets: Number(totalTablets),
      tabletsPerDose: Number(tabletsPerDose),
      dosesPerDay: Number(dosesPerDay),
      lowStockThreshold: Number(lowStockThreshold)
    });

    await newMed.save();
    res.status(201).json(newMed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Keep the rest of your controller (getMedications, update, delete) as is.
// ✅ Get All Medications
exports.getMedications = async (req, res) => {
  try {
    // Standardizing the ID check to match your auth token payload
    const userId = req.user.id || req.user._id || req.user;
    const meds = await Medication.find({ userId: userId });
    res.json(meds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update Medication
exports.updateMedication = async (req, res) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ message: "Medication not found" });

    const userId = req.user.id || req.user._id || req.user;
    if (med.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const updated = await Medication.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete Medication
exports.deleteMedication = async (req, res) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ message: "Medication not found" });

    const userId = req.user.id || req.user._id || req.user;
    if (med.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await med.deleteOne();
    res.json({ message: "Medication removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};