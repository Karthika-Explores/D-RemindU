const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const { markTaken, markMissed } = require("../controllers/logController");

router.post("/taken", protect, markTaken);
router.post("/missed", protect, markMissed);

module.exports = router;