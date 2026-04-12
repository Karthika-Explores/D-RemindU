const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const logRoutes = require("./routes/logRoutes");
const reportRoutes = require("./routes/reportRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");

dotenv.config();

connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: "*", // This allows your frontend to talk to your backend from any domain
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use("/api/auth", authRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("D RemindU API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});