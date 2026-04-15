const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  // Check both 'authorization' (lowercase) and 'Authorization' (uppercase)
  const authHeader = req.headers.authorization || req.header("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Ensure this matches the key you used in your Login controller (id vs _id)
    req.user = decoded.id; 
    next();
  } catch (err) {
    // This is the error you are seeing in the console
    res.status(401).json({ message: "Invalid token" });
  }
};