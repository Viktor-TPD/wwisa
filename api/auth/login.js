import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { head } from "@vercel/blob";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const JWT_EXPIRES_IN = "7d";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  try {
    // Get user data using Vercel Blob SDK
    const userBlob = await head(`users/${username}/profile.json`);

    // Fetch the actual content
    const response = await fetch(userBlob.url);

    if (!response.ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const userData = await response.json();

    const validPassword = await bcrypt.compare(password, userData.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign(
      { username: userData.username, email: userData.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.setHeader(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${
        7 * 24 * 60 * 60
      }; SameSite=Strict; Secure`
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        username: userData.username,
        email: userData.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid username or password",
    });
  }
}
