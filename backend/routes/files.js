const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticateToken } = require("../auth");
const config = require("../config");
const {
  createFile,
  getFilesByUserId,
  getFileById,
  deleteFile,
  deleteAllUserFiles,
} = require("../database");

const router = express.Router();

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(config.uploadDir, `user_${req.user.id}`);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${path.basename(file.originalname, ext)}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".bnk" || ext === ".wem" || ext === ".xml" || ext === ".wwu") {
      cb(null, true);
    } else {
      cb(new Error("Only .bnk, .wem, and .xml files are allowed!"), false);
    }
  },
  limits: {
    fileSize: config.maxFileSize,
  },
});

router.use(authenticateToken);

router.post(
  "/upload",
  upload.array("files", config.maxFilesPerUpload),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded",
        });
      }

      const uploadedFiles = [];

      for (const file of req.files) {
        const fileRecord = await createFile(
          req.user.id,
          file.filename,
          file.originalname,
          path.extname(file.originalname),
          file.size
        );

        uploadedFiles.push({
          id: fileRecord.id,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          type: path.extname(file.originalname),
        });
      }

      console.log(
        `✓ User ${req.user.username} uploaded ${uploadedFiles.length} file(s)`
      );

      res.json({
        success: true,
        message: `Uploaded ${uploadedFiles.length} file(s)`,
        files: uploadedFiles,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: "Upload failed",
        error: error.message,
      });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const files = await getFilesByUserId(req.user.id);

    res.json({
      success: true,
      files: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        originalName: file.original_name,
        fileType: file.file_type,
        fileSize: file.file_size,
        uploadedAt: file.uploaded_at,
      })),
    });
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list files",
      error: error.message,
    });
  }
});

// Download specific file
router.get("/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const file = await getFileById(fileId, req.user.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const filePath = path.resolve(
      config.uploadDir,
      `user_${req.user.id}`,
      file.filename
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on disk",
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({
      success: false,
      message: "Download failed",
      error: error.message,
    });
  }
});

// Delete specific file
router.delete("/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const file = await getFileById(fileId, req.user.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const filePath = path.join(
      config.uploadDir,
      `user_${req.user.id}`,
      file.filename
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await deleteFile(fileId, req.user.id);

    console.log(
      `✓ User ${req.user.username} deleted file: ${file.original_name}`
    );

    res.json({
      success: true,
      message: "File deleted",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Delete failed",
      error: error.message,
    });
  }
});

// Delete all user files
router.delete("/", async (req, res) => {
  try {
    const files = await getFilesByUserId(req.user.id);

    const userDir = path.join(config.uploadDir, `user_${req.user.id}`);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }

    await deleteAllUserFiles(req.user.id);

    console.log(
      `✓ User ${req.user.username} deleted all files (${files.length})`
    );

    res.json({
      success: true,
      message: `Deleted ${files.length} file(s)`,
    });
  } catch (error) {
    console.error("Clear files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear files",
      error: error.message,
    });
  }
});

module.exports = router;
