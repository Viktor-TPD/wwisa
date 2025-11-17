require("dotenv").config();

module.exports = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // JWT
  jwtSecret: process.env.JWT_SECRET || "default-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // Database
  databasePath: process.env.DATABASE_PATH || "./wwisa.db",

  // CORS
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
  maxFilesPerUpload: parseInt(process.env.MAX_FILES_PER_UPLOAD) || 20,
  uploadDir: process.env.UPLOAD_DIR || "./uploads",

  // Bcrypt
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // Allowed file types
  allowedFileTypes: [".bnk", ".wem", ".xml", ".wwu"],
};
