import { useState } from "react";
import { uploadPrescription } from "../services/prescriptionapi"; 
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

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
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");

    setLoading(true);
    try {
      const data = await uploadPrescription(file);
      const extractedText = data?.prescription?.extractedText || "";
      setText(extractedText);

      let meds = extractMedicines(extractedText);
      
      // Fallback: if regex didn't find specific dosage words, just grab the first line or raw text
      if (meds.length === 0 && extractedText.trim() !== "") {
         meds = [extractedText.split("\n")[0]]; // use first line as best guess
      }

      const parsedMeds = meds.map(med => parseMedicine(med));

      // ✅ Store with specific keys
      localStorage.setItem("extractedMeds", JSON.stringify(parsedMeds));

      // ✅ Redirect to Dashboard where useEffect will catch it
      navigate("/dashboard");

    } catch (error) {
      console.error("Upload failed:", error.response?.data || error.message);
      alert(error.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setText("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 glass bg-white hover:bg-slate-100 flex items-center justify-center rounded-full transition shadow-sm text-slate-500 hover:text-slate-800 text-xl font-bold">
            ←
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Upload <span className="text-gradient">Prescription</span></h1>
            <p className="text-slate-500 font-medium mt-2">Let our AI extract your medicines automatically.</p>
          </div>
        </div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass p-6 sm:p-10 rounded-[2.5rem] relative overflow-hidden shadow-xl border border-white/60">
          
          <div 
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 relative ${dragActive ? 'border-indigo-500 bg-indigo-50/70 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setFile(e.target.files[0])} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-inner transition-colors duration-300 mb-2 ${file ? 'bg-emerald-100 text-emerald-500' : 'bg-indigo-100 text-indigo-500'}`}>
                {file ? '✓' : '📄'}
              </div>
              <h3 className="text-xl font-bold text-slate-800 max-w-full truncate px-4">
                {file ? file.name : "Drag & Drop your file here"}
              </h3>
              <p className="text-sm font-medium text-slate-500">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or click to browse from your device"}
              </p>
              {file && (
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(); }} className="mt-4 relative z-20 text-rose-500 hover:text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 px-5 py-2 rounded-full text-sm transition">
                  Remove File
                </button>
              )}
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={handleUpload} 
              disabled={loading || !file}
              className={`w-full py-4 rounded-2xl font-black text-lg transition duration-300 ${
                loading || !file 
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 hover:-translate-y-1"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Processing Magic...
                </span>
              ) : "Extract Medicines"}
            </button>
          </div>

          {text && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-8 pt-8 border-t border-slate-200">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-600 w-6 h-6 flex items-center justify-center rounded-full text-xs">✓</span>
                Extracted Text
              </h4>
              <textarea value={text} readOnly className="w-full h-40 p-4 border border-slate-200 rounded-2xl bg-slate-50/80 text-slate-600 text-sm outline-none resize-none font-medium" />
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

export default UploadPrescription;