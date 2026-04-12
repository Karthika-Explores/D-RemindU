const axios = require("axios");
const fs = require("fs");
const Prescription = require("../models/Prescription");

// 📸 Upload + OCR
exports.uploadPrescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;

    const image = fs.readFileSync(filePath, { encoding: "base64" });

    const response = await axios.post(
  "https://api.ocr.space/parse/image",
  new URLSearchParams({
    base64Image: `data:image/jpeg;base64,${image}`,
    language: "eng"
  }),
  {
    headers: {
      apikey: process.env.OCR_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  }
);

    const extractedText =
      response.data.ParsedResults?.[0]?.ParsedText || "No text found";

    const prescription = new Prescription({
  userId: req.user,
  fileUrl: filePath,
  extractedText: extractedText
});

    await prescription.save(); // 🔥 VERY IMPORTANT

    res.json({
      message: "Prescription uploaded successfully",
      extractedText,
      prescription
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};