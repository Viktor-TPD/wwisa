const jwt = require("jsonwebtoken");
const config = require("./config");

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

// Verify JWT token middleware
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header or cookie
  const authHeader = req.headers["authorization"];
  const token = (authHeader && authHeader.split(" ")[1]) || req.cookies.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const verified = jwt.verify(token, config.jwtSecret);
    req.user = verified; // Add user info to request
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

module.exports = {
  generateToken,
  authenticateToken,
};
