const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  // 🚨 Handle both lowercase and uppercase headers for Render
  const authHeader = req.headers.authorization || req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ message: "No token, access denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 🚨 Ensure JWT_SECRET in Render Dashboard matches your code
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user ID. Check if your login uses .id or ._id
    req.user = decoded.id || decoded._id; 
    next();
  } catch (err) {
    // This is exactly what you see in your console
    res.status(401).json({ message: "Invalid token" });
  }
};