import { put, list, del } from "@vercel/blob";
import jwt from "jsonwebtoken";
import multiparty from "multiparty";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
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

  const path = req.url.split("/api/files")[1] || "/";

  try {
    if (path === "/upload" && req.method === "POST") {
      return await handleUpload(req, res, user);
    } else if (path === "/" && req.method === "GET") {
      return await handleList(req, res, user);
    } else if (path.match(/^\/\d+$/) && req.method === "GET") {
      return await handleDownload(req, res, user, path);
    } else if (path.match(/^\/\d+$/) && req.method === "DELETE") {
      return await handleDelete(req, res, user, path);
    } else if (path === "/" && req.method === "DELETE") {
      return await handleDeleteAll(req, res, user);
    }

    res.status(404).json({ success: false, message: "Not found" });
  } catch (error) {
    console.error("Files error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function handleUpload(req, res, user) {
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
          const fileBuffer = require("fs").readFileSync(file.path);
          const ext = require("path").extname(file.originalFilename);

          // Validate file type
          if (![".bnk", ".wem", ".xml", ".wwu"].includes(ext.toLowerCase())) {
            continue;
          }

          const timestamp = Date.now();
          const blobPath = `users/${user.username}/files/${timestamp}-${file.originalFilename}`;

          const blob = await put(blobPath, fileBuffer, {
            access: "public",
            addRandomSuffix: false,
          });

          results.push({
            id: timestamp,
            filename: `${timestamp}-${file.originalFilename}`,
            originalName: file.originalFilename,
            size: file.size,
            type: ext,
            url: blob.url,
          });

          // Clean up temp file
          require("fs").unlinkSync(file.path);
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

async function handleList(req, res, user) {
  const { blobs } = await list({
    prefix: `users/${user.username}/files/`,
  });

  const files = blobs.map((blob) => {
    const filename = blob.pathname.split("/").pop();
    const parts = filename.split("-");
    const id = parseInt(parts[0]);
    const originalName = parts.slice(1).join("-");
    const ext = require("path").extname(originalName);

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

  res.json({ success: true, files });
}

async function handleDownload(req, res, user, path) {
  const fileId = path.substring(1);

  const { blobs } = await list({
    prefix: `users/${user.username}/files/${fileId}-`,
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
}

async function handleDelete(req, res, user, path) {
  const fileId = path.substring(1);

  const { blobs } = await list({
    prefix: `users/${user.username}/files/${fileId}-`,
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
}

async function handleDeleteAll(req, res, user) {
  const { blobs } = await list({
    prefix: `users/${user.username}/files/`,
  });

  const urls = blobs.map((b) => b.url);
  if (urls.length > 0) {
    await del(urls);
  }

  res.json({
    success: true,
    message: `Deleted ${urls.length} file(s)`,
  });
}
