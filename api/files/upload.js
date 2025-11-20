import { put } from "@vercel/blob";
import jwt from "jsonwebtoken";
import multiparty from "multiparty";
import fs from "fs";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "50mb",
  },
};

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

  const form = new multiparty.Form();

  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return resolve();
      }

      const uploadedFiles = files.files || [];
      const results = [];

      for (const file of uploadedFiles) {
        try {
          const fileBuffer = fs.readFileSync(file.path);
          const ext = path.extname(file.originalFilename);

          // Validate file type
          if (![".bnk", ".wem", ".xml", ".wwu"].includes(ext.toLowerCase())) {
            console.log(`Skipping invalid file type: ${ext}`); // ← Add logging
            continue;
          }

          const timestamp = Date.now();
          const blobPath = `users/${user.username}/files/${timestamp}-${file.originalFilename}`;

          console.log(`Uploading to blob: ${blobPath}`); // ← Add logging

          const blob = await put(blobPath, fileBuffer, {
            access: "public",
            addRandomSuffix: false,
          });

          console.log(`Upload successful: ${blob.url}`); // ← Add logging

          results.push({
            id: timestamp,
            filename: `${timestamp}-${file.originalFilename}`,
            originalName: file.originalFilename,
            size: file.size,
            type: ext,
            url: blob.url,
          });

          // Clean up temp file
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error("Upload error:", error);
        }
      }

      res.json({
        success: true,
        message: `Uploaded ${results.length} file(s)`,
        files: results,
      });
      resolve();
    });
  });
}
