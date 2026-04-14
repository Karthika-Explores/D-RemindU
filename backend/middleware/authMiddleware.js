// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      // IF THIS SECRET IS UNDEFINED, IT WILL THROW A 500 ERROR
      const decoded = jwt.verify(token, process.env.JWT_SECRET); 
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized' });
    }
  } else {
    res.status(401).json({ message: 'No token' });
  }
};
module.exports = protect;