const express = require("express");
const bcrypt = require("bcrypt");
const {
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
} = require("../database");
const { generateToken, authenticateToken } = require("../auth");
const config = require("../config");

const router = express.Router();

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

    // Create user
    const user = await createUser(username, email, hashedPassword);

    // Generate token
    const token = generateToken(user);

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "strict",
    });

    console.log(`✓ New user registered: ${username}`);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Get user
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Generate token
    const token = generateToken(user);

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });

    console.log(`✓ User logged in: ${username}`);

    res.json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// Get current user
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: error.message,
    });
  }
});

module.exports = router;
