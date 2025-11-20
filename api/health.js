export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  res.json({
    status: "OK",
    message: "Wwisa backend is running on Vercel!",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
  });
}
