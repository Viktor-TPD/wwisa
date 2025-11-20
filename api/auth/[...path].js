import { put, list } from "@vercel/blob";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const JWT_EXPIRES_IN = "7d";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Get the path from query params
  const { path } = req.query;
  const route = Array.isArray(path) ? path[0] : path || "";
  try {
    if (route === "register" && req.method === "POST") {
      return await handleRegister(req, res);
    } else if (route === "login" && req.method === "POST") {
      return await handleLogin(req, res);
    } else if (route === "logout" && req.method === "POST") {
      return await handleLogout(req, res);
    } else if (route === "me" && req.method === "GET") {
      return await handleGetUser(req, res);
    }

    res.status(404).json({ success: false, message: "Not found" });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function handleRegister(req, res) {
  const { username, email, password } = req.body;

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

  // Check if user exists by listing metadata
  const { blobs } = await list({ prefix: `users/${username}/`, limit: 1 });
  if (blobs.length > 0) {
    return res.status(409).json({
      success: false,
      message: "Username already exists",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Store user data as a blob with metadata
  const userData = {
    username,
    email,
    password: hashedPassword,
    created_at: new Date().toISOString(),
  };

  await put(`users/${username}/profile.json`, JSON.stringify(userData), {
    access: "public",
    addRandomSuffix: false,
  });

  const token = jwt.sign({ username, email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  res.setHeader(
    "Set-Cookie",
    `token=${token}; HttpOnly; Path=/; Max-Age=${
      7 * 24 * 60 * 60
    }; SameSite=Strict`
  );

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    user: { username, email },
  });
}

async function handleLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  // Get user data
  try {
    const response = await fetch(
      `${
        process.env.BLOB_READ_WRITE_TOKEN ? "https" : "http"
      }://public.blob.vercel-storage.com/users/${username}/profile.json`
    );

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
      }; SameSite=Strict`
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
    return res.status(401).json({
      success: false,
      message: "Invalid username or password",
    });
  }
}

async function handleLogout(req, res) {
  res.setHeader(
    "Set-Cookie",
    "token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict"
  );
  res.json({ success: true, message: "Logged out successfully" });
}

async function handleGetUser(req, res) {
  // Manual cookie parsing for Vercel
  const cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      cookies[name] = value;
    });
  }

  const token = cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    res.json({
      success: true,
      user: {
        username: verified.username,
        email: verified.email,
      },
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}
