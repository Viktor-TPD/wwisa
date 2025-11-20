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

  try {
    if (req.method === "GET") {
      // List all files
      const { blobs } = await list({
        prefix: `users/${user.username}/files/`,
      });

      const files = blobs.map((blob) => {
        const filename = blob.pathname.split("/").pop();

        // Try to extract ID from filename (format: timestamp-randomstr-originalname.ext)
        const parts = filename.split("-");
        let id, originalName;

        if (parts.length >= 2 && !isNaN(parts[0])) {
          // Has timestamp prefix
          id = parseInt(parts[0]);
          originalName = parts.slice(2).join("-"); // Skip timestamp and random string
        } else {
          // Fallback: use uploadedAt timestamp as ID
          id = new Date(blob.uploadedAt).getTime();
          originalName = filename;
        }

        const ext = originalName.substring(originalName.lastIndexOf("."));

        return {
          id,
          filename,
          originalName,
          fileType: ext,
          fileSize: blob.size,
          uploadedAt: blob.uploadedAt,
          url: blob.url,
        };
      });

      return res.json({ success: true, files });
    } else if (req.method === "DELETE") {
      // Delete all files
      const { blobs } = await list({
        prefix: `users/${user.username}/files/`,
      });

      const urls = blobs.map((b) => b.url);
      if (urls.length > 0) {
        await del(urls);
      }

      return res.json({
        success: true,
        message: `Deleted ${urls.length} file(s)`,
      });
    } else {
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed" });
    }
  } catch (error) {
    console.error("Files error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
