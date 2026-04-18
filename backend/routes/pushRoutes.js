const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// @route   POST /api/push/subscribe
// @desc    Subscribe user to Web Push notifications
// @access  Private
router.post("/subscribe", protect, async (req, res) => {
  try {
    const subscription = req.body;
    
    // Validate subscription payload
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: "Invalid subscription payload" });
    }

    const userId = req.user.id || req.user._id || req.user;
    
    // Find user and add subscription if it doesn't already exist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize if null
    if (!user.pushSubscriptions) {
      user.pushSubscriptions = [];
    }

    // Check for duplicates
    const existingIndex = user.pushSubscriptions.findIndex(
      sub => sub.endpoint === subscription.endpoint
    );

    if (existingIndex === -1) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    res.status(201).json({ message: "Subscription added successfully" });
  } catch (error) {
    console.error("Push subscribe error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
