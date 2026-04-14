import { useState } from "react";
import API from "../services/api";
import { uploadPrescription } from "../services/prescriptionapi";

// 🔍 Extract medicines
const extractMedicines = (text) => {
  const lines = text.split("\n");

  return lines.filter(line =>
    line.match(/\b(mg|ml|tablet|capsule)\b/i)
  );
};

const handleUpload = async () => {
  try {
    const data = await uploadPrescription(file);
    console.log("Success!", data);
  } catch (error) {
    console.error("Upload failed", error);
  }
};

// 🧠 Convert text → structured data
const parseMedicine = (line) => {
  const parts = line.split(" ");

  return {
    medicineName: parts[0],
    dosage: parts.find(p => p.includes("mg")) || "500mg",
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

  const handleUpload = async () => {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await API.post("/prescriptions/upload", formData);

      const extractedText = res.data.extractedText;
      setText(extractedText);

      const meds = extractMedicines(extractedText);
      const parsedMeds = meds.map(med => parseMedicine(med));

      localStorage.setItem("extractedMeds", JSON.stringify(parsedMeds));

      alert("Medicines extracted! Please review and add.");
      window.location.href = "/dashboard";

    } catch (error) {
      console.log(error.response?.data);
      alert("Upload failed");
    }
  };

  return (
    <div style={{ border: "1px solid black", padding: 10 }}>
      <h3>Upload Prescription</h3>

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <br /><br />

      <button onClick={handleUpload}>Upload & Extract</button>

      {text && (
        <div>
          <h4>Extracted Text:</h4>
          <textarea value={text} readOnly rows={6} cols={40} />
        </div>
      )}
    </div>
  );
}

export default UploadPrescription;