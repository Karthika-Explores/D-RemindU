const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  addMedication,
  getMedications,
  updateMedication,
  deleteMedication
} = require("../controllers/medicationController");

console.log("Protect Middleware:", protect);
console.log("AddMedication Controller:", addMedication);
router.post("/", protect, addMedication);
router.get("/", protect, getMedication);
router.put("/:id", protect, updateMedication);
router.delete("/:id", protect, deleteMedication);

module.exports = router;