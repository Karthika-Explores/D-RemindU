const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const { markTaken, markMissed, getLogs } = require("../controllers/logController");
router.get("/", protect, getLogs);
router.post("/taken", protect, markTaken);
router.post("/missed", protect, markMissed);

module.exports = router;