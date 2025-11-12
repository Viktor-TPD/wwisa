const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3001;

// Enable CORS for React frontend
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only accept .bnk and .wem files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".bnk" || ext === ".wem") {
      cb(null, true);
    } else {
      cb(new Error("Only .bnk and .wem files are allowed!"), false);
    }
  },
});

// Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Wwisa backend is running!" });
});

// Upload multiple files
app.post("/api/upload", upload.array("files"), (req, res) => {
  try {
    const files = req.files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: path.extname(file.originalname),
      path: file.path,
    }));

    console.log(
      `✓ Uploaded ${files.length} file(s):`,
      files.map((f) => f.filename)
    );

    res.json({
      success: true,
      message: `Uploaded ${files.length} file(s)`,
      files: files,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
});

// List uploaded files
app.get("/api/files", (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const fileList = files.map((filename) => {
      const filePath = path.join(UPLOAD_DIR, filename);
      const stats = fs.statSync(filePath);
      return {
        filename: filename,
        size: stats.size,
        type: path.extname(filename),
        uploadDate: stats.mtime,
      };
    });

    res.json({
      success: true,
      files: fileList,
    });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list files",
      error: error.message,
    });
  }
});

// Serve uploaded files
app.get("/api/files/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: "File not found",
    });
  }
});

// Delete a file
app.delete("/api/files/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✓ Deleted: ${filename}`);
      res.json({
        success: true,
        message: `Deleted ${filename}`,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
});

// Clear all files
app.delete("/api/files", (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    files.forEach((file) => {
      fs.unlinkSync(path.join(UPLOAD_DIR, file));
    });
    console.log(`✓ Cleared all files (${files.length})`);
    res.json({
      success: true,
      message: `Deleted ${files.length} file(s)`,
    });
  } catch (error) {
    console.error("Clear error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear files",
      error: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Wwisa backend running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
});
