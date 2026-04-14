const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // This is crucial: controllers need req.user to save to DB
    req.user = decoded; 
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};