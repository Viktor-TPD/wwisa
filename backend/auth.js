const jwt = require("jsonwebtoken");
const config = require("./config");

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

const authenticateToken = (req, res, next) => {
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
    req.user = verified;
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
