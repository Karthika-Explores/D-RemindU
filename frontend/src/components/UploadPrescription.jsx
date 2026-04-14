import { useState } from "react";
// Import the service function specifically
import { uploadPrescription } from "../services/prescriptionapi"; 

// 🔍 Helper: Extract lines containing specific keywords
const extractMedicines = (text) => {
  if (!text) return [];
  const lines = text.split("\n");
  return lines.filter(line =>
    line.match(/\b(mg|ml|tablet|capsule)\b/i)
  );
};

// 🧠 Helper: Convert a single text line into an object
const parseMedicine = (line) => {
  const parts = line.split(" ");
  return {
    medicineName: parts[0] || "Unknown Medicine",
    dosage: parts.find(p => p.toLowerCase().includes("mg")) || "500mg",
    instructions: "After food",
    reminderTime: "10:00",
    totalTablets: 10,
    tabletsPerDose: 1,
    dosesPerDay: 2,
    lowStockThreshold: 2
  };
};

function UploadPrescription() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");

    setLoading(true);
    try {
      // ✅ Call the service function (cleaner than manual API.post)
      const data = await uploadPrescription(file);

      const extractedText = data.extractedText;
      setText(extractedText);

      // Extract and Parse
      const meds = extractMedicines(extractedText);
      const parsedMeds = meds.map(med => parseMedicine(med));

      // Store in localStorage for the Dashboard to pick up
      localStorage.setItem("extractedMeds", JSON.stringify(parsedMeds));

      alert("Medicines extracted! Please review and add.");
      
      // Navigate to dashboard
      window.location.href = "/dashboard";

    } catch (error) {
      console.error("Upload failed details:", error.response?.data || error.message);
      alert(error.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
      <h3>Upload Prescription</h3>

      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => setFile(e.target.files[0])} 
      />
      <br /><br />

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Processing..." : "Upload & Extract"}
      </button>

      {text && (
        <div style={{ marginTop: "20px" }}>
          <h4>Extracted Text (Debug):</h4>
          <textarea value={text} readOnly rows={6} cols={40} style={{ width: "100%" }} />
        </div>
      )}
    </div>
  );
}

export default UploadPrescription;