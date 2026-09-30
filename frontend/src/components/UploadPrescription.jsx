import { useState } from "react";
import { uploadPrescription } from "../services/prescriptionapi"; 
import { useNavigate } from "react-router-dom";
// eslint-disable-next-line no-unused-vars -- `motion` is used as JSX namespace: <motion.div>
import { motion } from "framer-motion";
import DRemindULogo from "./DRemindULogo";

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
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col pt-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="w-10 h-10 bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center rounded-xl transition shadow-xs text-slate-300 hover:text-white cursor-pointer" title="Back to Dashboard">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Upload <span className="text-yellow-400">Prescription</span></h1>
              <p className="text-slate-400 font-medium text-xs sm:text-sm mt-1">Automated OCR scans and pre-fills your prescription schedule.</p>
            </div>
          </div>
          <DRemindULogo size="sm" onClick={() => navigate("/dashboard")} className="cursor-pointer hidden sm:inline-flex" />
        </div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900/90 p-6 sm:p-8 rounded-2xl relative overflow-hidden shadow-2xl border border-slate-800">
          
          <div 
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 relative ${dragActive ? 'border-yellow-400 bg-yellow-400/10 scale-[1.01]' : 'border-slate-700 bg-slate-950/60 hover:border-yellow-400/70 hover:bg-slate-950'}`}
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
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${file ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'}`}>
                {file ? (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
              </div>
              <h3 className="text-base font-bold text-white max-w-full truncate px-4">
                {file ? file.name : "Drag & drop your prescription image here"}
              </h3>
              <p className="text-xs text-slate-400">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or click to browse from your device"}
              </p>
              {file && (
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(); }} className="mt-2 relative z-20 text-rose-400 hover:text-rose-300 font-semibold bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/80 px-4 py-1.5 rounded-lg text-xs transition cursor-pointer">
                  Remove File
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button 
              onClick={handleUpload} 
              disabled={loading || !file}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                loading || !file 
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700" 
                  : "bg-yellow-400 hover:bg-yellow-300 text-slate-950 shadow-md shadow-yellow-400/20"
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-slate-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Scanning Prescription via OCR...</span>
                </>
              ) : "Extract Medicines"}
            </button>
          </div>

          {text && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 pt-6 border-t border-slate-800">
              <h4 className="font-bold text-white mb-2.5 flex items-center gap-2 text-xs">
                <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800 w-5 h-5 flex items-center justify-center rounded text-[10px]">✓</span>
                Extracted Text
              </h4>
              <textarea value={text} readOnly className="w-full h-36 p-3.5 border border-slate-800 rounded-xl bg-slate-950 text-slate-300 text-xs outline-none resize-none font-mono" />
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

export default UploadPrescription;