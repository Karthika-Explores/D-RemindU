const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const logRoutes = require("./routes/logRoutes");
const reportRoutes = require("./routes/reportRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const userRoutes = require("./routes/userRoutes");
const pushRoutes = require("./routes/pushRoutes");
const { startCronJobs } = require("./services/cronService");

connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: "*", // Allows any frontend domain to talk to this backend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Primary API Routes (prefixed with /api)
app.use("/api/auth", authRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/user", userRoutes);
app.use("/api/push", pushRoutes);

// Fallback Routes (without /api prefix, so requests never 404 if VITE_API_URL was set without /api)
app.use("/auth", authRoutes);
app.use("/medications", medicationRoutes);
app.use("/logs", logRoutes);
app.use("/reports", reportRoutes);
app.use("/prescriptions", prescriptionRoutes);
app.use("/user", userRoutes);
app.use("/push", pushRoutes);

// Test & Health routes
app.get("/", (req, res) => {
  res.send("DRemindU API is running...");
});

app.get(["/api/ping", "/ping"], (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Start Background Services
startCronJobs();

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});