const jwt = require("jsonwebtoken");

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
    req.user = decoded.id; 
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { protect };