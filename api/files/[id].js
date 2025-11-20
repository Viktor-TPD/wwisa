import { list, del } from "@vercel/blob";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Manual cookie parsing for Vercel
  const cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      cookies[name] = value;
    });
  }

  // Authenticate
  const token = cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }

  // Get file ID from query parameter
  const { id } = req.query;

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid file ID",
    });
  }

  try {
    if (req.method === "GET") {
      // Download file
      const { blobs } = await list({
        prefix: `users/${user.username}/files/${id}-`,
        limit: 1,
      });

      if (blobs.length === 0) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Redirect to blob URL
      res.redirect(blobs[0].url);
    } else if (req.method === "DELETE") {
      // Delete file
      const { blobs } = await list({
        prefix: `users/${user.username}/files/${id}-`,
        limit: 1,
      });

      if (blobs.length === 0) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      await del(blobs[0].url);

      res.json({
        success: true,
        message: "File deleted",
      });
    } else {
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed" });
    }
  } catch (error) {
    console.error("File operation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
