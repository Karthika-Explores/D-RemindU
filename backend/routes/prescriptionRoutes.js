const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  uploadPrescription
} = require("../controllers/prescriptionController");

router.post("/upload", protect, upload.single("image"), uploadPrescription);

module.exports = router;