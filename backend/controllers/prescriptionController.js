const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const axios = require("axios");
const Prescription = require("../models/Prescription");

exports.uploadPrescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 1. Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "prescriptions",
    });

    // 2. Perform OCR using the Cloudinary URL (More efficient than base64)
    const ocrResponse = await axios.post(
      "https://api.ocr.space/parse/image",
      new URLSearchParams({
        apikey: process.env.OCR_API_KEY,
        url: result.secure_url,
        language: "eng",
        isOverlayRequired: false,
        OCREngine: "2",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    // Safety check for OCR.space API errors
    if (ocrResponse.data.IsErroredOnProcessing) {
       throw new Error(ocrResponse.data.ErrorMessage || "OCR Processing failed");
    }

    const extractedText =
      ocrResponse.data.ParsedResults?.[0]?.ParsedText || "No text found";

    // 3. Save to DB using your specific Schema fields
    const prescription = new Prescription({
      userId: req.user._id || req.user.id || req.user, // Compatible with standard authMiddleware
      fileUrl: result.secure_url,
      extractedText: extractedText,
      isConfirmed: false // Defaulting to false for manual verification
    });

    await prescription.save();

    // 4. Cleanup: Delete local file from /uploads
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(201).json({
      message: "Prescription uploaded and processed successfully",
      prescription,
    });

  } catch (error) {
    // Ensure local file cleanup even on failure
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};