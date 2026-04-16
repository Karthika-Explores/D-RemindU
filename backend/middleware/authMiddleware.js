const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = async (req, res, next) => {
  // Render can lowercase headers; this check handles both
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ message: "No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 🚨 Attach the ID to req.user so the controllers can use it
    const user = await User.findById(decoded.id).select("-password");
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { protect };