const express = require("express");
const router = express.Router();

// Import the middleware
const {protect} = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Import the controller logic
const { uploadPrescription } = require("../controllers/prescriptionController");

// The Route
// "image" must match the name attribute in your frontend form/Postman body
router.post(
  "/upload", 
  protect, 
  upload.single("image"), 
  uploadPrescription
);

module.exports = router;