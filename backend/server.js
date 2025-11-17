const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");

require("./database");

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Wwisa backend is running!",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: config.nodeEnv === "development" ? err.message : undefined,
  });
});

app.listen(config.port, () => {
  console.log("");
  console.log("Wwisa Backend Server");
  console.log("========================");
  console.log(`✓ Environment: ${config.nodeEnv}`);
  console.log(`✓ Server running on http://localhost:${config.port}`);
  console.log(`✓ Frontend URL: ${config.frontendUrl}`);
  console.log(`✓ Database: ${config.databasePath}`);
  console.log(`✓ Upload directory: ${config.uploadDir}`);
  console.log(
    `✓ Max file size: ${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB`
  );
  console.log("");
  console.log("API Endpoints:");
  console.log("   POST   /api/auth/register");
  console.log("   POST   /api/auth/login");
  console.log("   POST   /api/auth/logout");
  console.log("   GET    /api/auth/me");
  console.log("   POST   /api/files/upload");
  console.log("   GET    /api/files");
  console.log("   GET    /api/files/:id");
  console.log("   DELETE /api/files/:id");
  console.log("   DELETE /api/files");
  console.log("");
});
