module.exports = function (app) {
  // Set CORS headers for SharedArrayBuffer support
  app.use((req, res, next) => {
    if (req.path.endsWith(".wasm")) {
      res.setHeader("Content-Type", "application/wasm");
    }
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  });
};
