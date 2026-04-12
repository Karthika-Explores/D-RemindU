const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  getWeeklyReport,
  getLowStock
} = require("../controllers/reportController");

router.get("/weekly", protect, getWeeklyReport);
router.get("/low-stock", protect, getLowStock);

module.exports = router;