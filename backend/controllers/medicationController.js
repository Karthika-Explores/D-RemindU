const Medication = require("../models/Medication");

// ✅ Get All Medications (FIXED: Added .id)
exports.getMedications = async (req, res) => {
  try {
    // If your token payload looks like { id: '...' }, use req.user.id
    const meds = await Medication.find({ userId: req.user.id || req.user });
    res.json(meds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update Medication (FIXED: .id and .toString() check)
exports.updateMedication = async (req, res) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ message: "Medication not found" });

    // Compare string IDs
    const userId = req.user.id || req.user;
    if (med.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const updated = await Medication.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete Medication (FIXED: .id and .toString() check)
exports.deleteMedication = async (req, res) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ message: "Medication not found" });

    const userId = req.user.id || req.user;
    if (med.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await med.deleteOne();
    res.json({ message: "Medication removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};