import { useState } from "react";
import { uploadPrescription } from "../services/prescriptionapi"; 
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();

// replace:
window.location.href = "/dashboard";

// with:
navigate("/dashboard");
// Helper: Extract lines with keywords
const extractMedicines = (text) => {
  if (!text) return [];
  const lines = text.split("\n");
  return lines.filter(line =>
    line.match(/\b(mg|ml|tablet|capsule)\b/i)
  );
};

// Helper: Convert text line to object with CORRECT KEYS
const parseMedicine = (line) => {
  return {
    // Ensure this matches your Dashboard state exactly
    medicineName: line.split(" ")[0] || "New Med", 
    dosage: "500mg",
    instructions: "After food",
    reminderTime: "08:00",
    totalTablets: 10,
    tabletsPerDose: 1,
    dosesPerDay: 1,
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
      const data = await uploadPrescription(file);
      const extractedText = data.extractedText || "";
      setText(extractedText);

      const meds = extractMedicines(extractedText);
      const parsedMeds = meds.map(med => parseMedicine(med));

      // ✅ Store with specific keys
      localStorage.setItem("extractedMeds", JSON.stringify(parsedMeds));

      alert("Medicines extracted! Please review and add.");
      
      // ✅ Redirect to Dashboard where useEffect will catch it
      window.location.href = "/dashboard";

    } catch (error) {
      console.error("Upload failed:", error.response?.data || error.message);
      alert(error.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h3 className="text-xl font-bold">Upload Prescription</h3>
      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => setFile(e.target.files[0])} 
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      <button 
        onClick={handleUpload} 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold disabled:bg-gray-400"
      >
        {loading ? "Processing..." : "Upload & Extract"}
      </button>
      {text && (
        <div className="mt-4">
          <h4 className="font-semibold">Extracted Text:</h4>
          <textarea value={text} readOnly className="w-full h-32 p-2 border rounded bg-gray-50" />
        </div>
      )}
    </div>
  );
}

export default UploadPrescription;