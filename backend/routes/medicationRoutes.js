const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  addMedication,
  getMedications,
  updateMedication,
  deleteMedication
} = require("../controllers/medicationController");

router.post("/", protect, addMedication);
router.get("/", protect, getMedications);
router.put("/:id", protect, updateMedication);
router.delete("/:id", protect, deleteMedication);

module.exports = router;