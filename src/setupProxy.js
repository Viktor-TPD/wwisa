const express = require("express");

module.exports = function (app) {
  // Set correct MIME type for WASM files
  app.use(
    express.static("public", {
      setHeaders: (res, path) => {
        if (path.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
      },
    })
  );

  // Set CORS headers for SharedArrayBuffer support (required for Wwise)
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  });
};
