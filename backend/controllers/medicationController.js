const Medication = require("../models/Medication");

// Add Medication
// Add Medication (Secure Version)
exports.addMedication = async (req, res) => {
  try {
    const { 
      medicineName, dosage, instructions, reminderTime, 
      totalTablets, tabletsPerDose, dosesPerDay, lowStockThreshold 
    } = req.body;

    const medication = await Medication.create({
      userId: req.user.id || req.user, // Strictly use the logged-in user's ID from the token
      medicineName,
      dosage,
      instructions,
      reminderTime,
      totalTablets,
      tabletsPerDose,
      dosesPerDay,
      lowStockThreshold
    });

    res.status(201).json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Medications
exports.getMedications = async (req, res) => {
  try {
    const meds = await Medication.find({ userId: req.user });
    res.json(meds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Medication
exports.updateMedication = async (req, res) => {
  try {
    const med = await Medication.findById(req.params.id);

    if (!med) return res.status(404).json({ message: "Medication not found" });

    if (med.userId.toString() !== req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const updated = await Medication.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Medication
exports.deleteMedication = async (req, res) => {
  try {
    const med = await Medication.findById(req.params.id);

    if (!med) return res.status(404).json({ message: "Medication not found" });

    if (med.userId.toString() !== req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await med.deleteOne();

    res.json({ message: "Medication removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};