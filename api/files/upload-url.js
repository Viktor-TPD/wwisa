import { handleUpload } from "@vercel/blob/client";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Authenticate
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
    return res.status(401).json({ success: false, message: "Access denied" });
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const filename = pathname;

        const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
        if (![".bnk", ".wem", ".xml", ".wwu"].includes(ext)) {
          throw new Error("Invalid file type");
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const uniqueId = `${timestamp}-${randomStr}`;

        const fullPath = `users/${user.username}/files/${uniqueId}-${filename}`;

        console.log("Generated pathname:", fullPath);

        return {
          allowedContentTypes: [
            "application/octet-stream",
            "text/xml",
            "application/xml",
            "application/x-binary",
            "binary/octet-stream",
            "unknown",
          ],
          tokenPayload: JSON.stringify({
            userId: user.username,
            timestamp,
            uniqueId,
          }),
          pathname: fullPath,
          addRandomSuffix: false,
        };
      },
      // Remove onUploadCompleted - it causes a second authenticated request
    });

    return res.json(jsonResponse);
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
}
