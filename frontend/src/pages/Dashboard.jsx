import { useEffect, useState } from "react";
import API from "../services/api";
import { speakReminder } from "../utils/voice";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import UsageChart from "./UsageChart";

let lastTriggered = "";

function Dashboard() {
  const [form, setForm] = useState({
  medicineName: "",
  dosage: "",
  instructions: "",
  reminderTime: "",
  totalTablets: "",
  tabletsPerDose: "",
  dosesPerDay: "",
  lowStockThreshold: "",
  injectionSite: "", // ✅ NEW
  mealTiming: "" // NEW
});

  const [queue, setQueue] = useState([]);
  const [medications, setMedications] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");
  const [queueIndex, setQueueIndex] = useState(0);
  const [activeReminder, setActiveReminder] = useState(null);
  const [repeatTimer, setRepeatTimer] = useState(null);
  const [triggeredStock, setTriggeredStock] = useState({});
  const sites = ["Left Abdomen", "Right Abdomen", "Left Thigh", "Right Thigh"];
  const [showEmergency, setShowEmergency] = useState(false);
  // 🚨 ADDED MISSING STATES
  const [takenQty, setTakenQty] = useState(1);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [extractedQueue, setExtractedQueue] = useState([]);
  const [stats, setStats] = useState({ taken: 0, missed: 0, adherence: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("extractedMeds");
    if (stored) {
  try {
    const data = JSON.parse(stored);

    if (data && data.length > 0) {
  setExtractedQueue(data);
  setQueueIndex(0);
  setForm(data[0]); // first item
}
  } catch (e) {
    console.error("Queue parse error:", e);
  }
}
    fetchMeds();
    fetchStats();
  }, []);

  const handleNextInQueue = () => {
  const nextIndex = queueIndex + 1;

  if (nextIndex >= extractedQueue.length) {
    // ✅ Finished
    setExtractedQueue([]);
    setQueueIndex(0);
    localStorage.removeItem("extractedMeds");

    setForm({
      medicineName: "",
      dosage: "",
      instructions: "",
      reminderTime: "",
      totalTablets: "",
      tabletsPerDose: "",
      dosesPerDay: "",
      lowStockThreshold: ""
    });

    return;
  }

  // ✅ Move to next
  setQueueIndex(nextIndex);
  setForm(extractedQueue[nextIndex]);
};;

  // ✅ REMINDER SYSTEM
  useEffect(() => {
    if (activeReminder) return;

    const interval = setInterval(() => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();

      medications.forEach((med) => {
        if (!med.reminderTime) return;
        const [hh, mm] = med.reminderTime.split(":");

        if (Number(hh) === h && Number(mm) === m && lastTriggered !== med._id + h + m) {
          lastTriggered = med._id + h + m;
          triggerReminder(med, "time");
        }

        // Inside the medications.forEach loop in Dashboard.jsx
if (
  Number(med.totalTablets) <= Number(med.lowStockThreshold) && 
  !triggeredStock[med._id]
) {
  setTriggeredStock(prev => ({
    ...prev,
    [med._id]: true
  }));

  triggerReminder(med, "stock");
}
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [medications, activeReminder]);

  const triggerReminder = (med, type) => {
    if (activeReminder) return;

    setActiveReminder({ ...med, type });
    setSelectedMed(med);
    setTakenQty(med.tabletsPerDose || 1);

    if (type === "time") {
      speakReminder(med.medicineName, language);
    } else if (type === "stock") {
      speakReminder(`${med.medicineName} is running low`, language);
    }

    const timer = setTimeout(() => {
      setActiveReminder(null);
    }, 5 * 60 * 1000);
    setRepeatTimer(timer);
  };

  const fetchMeds = async () => {
    try {
      const res = await API.get("/medications");
      setMedications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/logs");
      const logs = res.data || [];
      const taken = logs.filter(l => l.status === "Taken").length;
      const missed = logs.filter(l => l.status === "Missed").length;
      const adherence = (taken + missed === 0) ? 0 : Math.round((taken / (taken + missed)) * 100);
      setStats({ taken, missed, adherence });
    } catch (err) {
      console.error("Stats error:", err);
    }
  };
  const nextSite = (current) => {
  const index = sites.indexOf(current);
  return sites[(index + 1) % sites.length];
};
  const handleAdd = async () => {
  try {
    await API.post("/medications", {
      ...form,
      injectionSite: (form.injectionSite),
      totalTablets: Number(form.totalTablets),
      tabletsPerDose: Number(form.tabletsPerDose),
      dosesPerDay: Number(form.dosesPerDay),
      lowStockThreshold: Number(form.lowStockThreshold)
    });

    fetchMeds();

    // ✅ move to next after user edit
    handleNextInQueue();

    alert("Medicine saved");

  } catch (error) {
    console.error(error);
  }
};

  const markTaken = async (med) => {
  clearTimeout(repeatTimer);
  setActiveReminder(null);

  try {
    // ✅ check if this is low stock reminder
    const isLowStock =
      activeReminder &&
      activeReminder._id === med._id &&
      activeReminder.type === "stock";

    // ✅ use correct amount
    const amount = isLowStock
      ? Number(takenQty)
      : Number(med.tabletsPerDose || 1);

    const updatedCount = Math.max(
      0,
      Number(med.totalTablets) - amount
    );

    // ✅ UPDATE BACKEND
    await API.put(`/medications/${med._id}`, {
      ...med,
      totalTablets: updatedCount
    });

    // ✅ LOG ENTRY
    await API.post("/logs/taken", {
      medicationId: med._id
    });

    // ✅ RESET INPUT (important)
    setTakenQty(1);

    // ✅ REFRESH UI
    await fetchMeds();
    await fetchStats();

  } catch (error) {
    console.error("Mark taken failed:", error);
  }
};

  const handleStockUpdate = async (med) => {
  try {
    const quantity = Number(takenQty);

    if (!quantity || quantity <= 0) return;

    // ✅ Calculate updated values
    const updatedStock = Math.max(
      0,
      Number(med.totalTablets) - quantity
    );

    const updatedDosesTaken =
      Number(med.dosesTaken || 0) + quantity;

    // ✅ 1. UPDATE UI IMMEDIATELY (optimistic update)
    setMedications((prev) =>
      prev.map((m) =>
        m._id === med._id
          ? {
              ...m,
              totalTablets: updatedStock,
              dosesTaken: updatedDosesTaken
            }
          : m
      )
    );

    // ✅ 2. SEND UPDATE TO BACKEND
    await API.put(`/medications/${med._id}`, {
      ...med,
      totalTablets: updatedStock,
      dosesTaken: updatedDosesTaken
    });

    // ✅ 3. LOG ENTRY (optional but recommended)
    await API.post("/logs/taken", {
      medicationId: med._id
    });

    // ✅ 4. RESET UI STATE
    setTakenQty(1);
    setActiveReminder(null);

  } catch (error) {
    console.error("Stock update failed:", error);

    // ❗ OPTIONAL: rollback UI if API fails
    fetchMeds();
  }
};

  const markMissed = async (id) => {
    clearTimeout(repeatTimer);
    setActiveReminder(null);
    await API.post("/logs/missed", { medicationId: id });
    const med = medications.find(m => m._id === id);
    setTimeout(() => { triggerReminder(med, "time"); }, 5 * 60 * 1000);
    fetchStats();
  };

  const allowedFields = [
    "medicineName", "dosage", "instructions", "reminderTime", 
    "totalTablets", "tabletsPerDose", "dosesPerDay", "lowStockThreshold","injectionSite"
  ];

  const startEdit = (med) => {
  setEditingId(med._id);
  setEditForm(med); // Pre-fills the edit form with current data
};

const handleUpdate = async () => {
  try {
    await API.put(`/medications/${editingId}`, {
      ...editForm,
      totalTablets: Number(editForm.totalTablets),
      tabletsPerDose: Number(editForm.tabletsPerDose),
      dosesPerDay: Number(editForm.dosesPerDay),
      lowStockThreshold: Number(editForm.lowStockThreshold)
    });
    setEditingId(null); // Exit edit mode
    fetchMeds(); // Refresh the list
  } catch (error) {
    console.error("Update failed:", error);
  }
};
    {showEmergency && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-xl w-96 text-center">

      <h2 className="text-xl font-bold text-red-600 mb-4">
        ⚠ Hypoglycemia Alert
      </h2>

      <p className="text-sm mb-3">
        Follow the <b>15-15 Rule</b>:
      </p>

      <ul className="text-left text-sm mb-4">
        <li>• Take 15g fast sugar (glucose tablets, juice)</li>
        <li>• Wait 15 minutes</li>
        <li>• Recheck blood sugar</li>
        <li>• Repeat if still low</li>
      </ul>

      <button
        onClick={() => {
          <a href="tel:1234567890">
  <button className="bg-red-500 text-white px-4 py-2 rounded w-full mb-2">
    📞 Call Emergency Contact
  </button>
</a> // replace later
        }}
        className="bg-red-500 text-white px-4 py-2 rounded w-full mb-2"
      >
        📞 Call Emergency Contact
      </button>

      <button
        onClick={() => setShowEmergency(false)}
        className="bg-gray-400 text-white px-4 py-2 rounded w-full"
      >
        Close
      </button>

    </div>
  </div>
)}

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 p-6">
    <Navbar />
    <div className="flex justify-end mb-4">
  <button
    onClick={() => navigate("/profile")}
    className="bg-gray-200 px-3 py-1 rounded"
  >
    👤 Profile
  </button>
</div>
      <h1 className="text-3xl font-bold mb-4 text-blue-700">Dashboard</h1>

      {/* SETTINGS BAR */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="font-semibold">Language:</label>
        <select
          className="p-2 border rounded"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            localStorage.setItem("language", e.target.value);
          }}
        >
          <option value="en-US">English</option>
          <option value="hi-IN">Hindi</option>
          <option value="kn-IN">Kannada</option>
          <option value="ta-IN">Tamil</option>
        </select>
        <button onClick={() => (window.location.href = "/upload")} className="bg-purple-600 text-white px-3 py-2 rounded">
          Upload Prescription
        </button>
      </div>
          <select
  value={form.injectionSite}
  onChange={(e) =>
    setForm({ ...form, injectionSite: e.target.value })
  }
  className="border p-2 rounded w-full"
>
  <option value="">Select Injection Site</option>
  <option>Left Abdomen</option>
  <option>Right Abdomen</option>
  <option>Left Thigh</option>
  <option>Right Thigh</option>
  <option>Left Arm</option>
  <option>Right Arm</option>
</select>

      {/* ADD MEDICATION SECTION */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3 text-lg">Add Medication</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {allowedFields.map((field) => (
            <input
              key={field}
              placeholder={field}
              value={form.medicineName}
onChange={(e) => setForm({ ...form, medicineName: e.target.value })}
              className="p-2 border rounded focus:ring-2 focus:ring-blue-400 outline-none"
            />
          ))}
        </div>
        <button onClick={handleAdd} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition">
          Add Medication
        </button>
      </div>
      <button
        type="button"
        onClick={handleNextInQueue}
        className="bg-gray-400 text-white px-4 py-2 rounded"
      >
        Skip
      </button>
        {extractedQueue.length > 0 && (
  <p className="text-blue-500 text-sm">
    Reviewing {queueIndex + 1} of {extractedQueue.length}
  </p>
)}
      <select
  value={form.mealTiming}
  onChange={(e) =>
    setForm({ ...form, mealTiming: e.target.value })
  }
  className="border p-2 rounded w-full"
>
  <option value="">Meal Timing</option>
  <option>Before Food</option>
  <option>After Food</option>
  <option>With Food</option>
</select>
      {/* ANALYTICS & LIST (Omitted for brevity, keep your existing UI) */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Weekly Report</h2>
        <p>Taken: {stats.taken} | Missed: {stats.missed} | Adherence: {stats.adherence}%</p>
      </div>

      {/* 💊 MEDICATION LIST */}
<div className="grid md:grid-cols-3 gap-4">
  {medications.map((med) => (
    <div key={med._id} className="bg-white p-4 rounded-xl shadow border-t-4 border-blue-500">
      {editingId === med._id ? (
        <>
          {/* Edit Mode Inputs */}
          {allowedFields.map((field) => (
            <input
              key={field}
              value={form.medicineName}
              onChange={(e) => setForm({ ...form, medicineName: e.target.value })}
              className="p-2 border rounded mb-2 w-full text-sm"
            />
          ))}
          <div className="flex gap-2 mt-2">
            <button onClick={handleUpdate} className="bg-green-500 text-white px-3 py-1 rounded flex-1">Save</button>
            <button onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-3 py-1 rounded flex-1">Cancel</button>
          </div>
        </>
      ) : (
        <>
          {/* View Mode */}
          <h3 className="font-bold text-lg text-gray-800">{med.medicineName}</h3>
          <p className="text-sm">Stock: {med.totalTablets} left</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => markTaken(med)} className="bg-green-500 text-white px-3 py-1 rounded flex-1">Taken</button>
            <button onClick={() => markMissed(med._id)} className="bg-red-500 text-white px-3 py-1 rounded flex-1">Missed</button>
            {/* ✅ THE MISSING BUTTON */}
            <button onClick={() => startEdit(med)} className="bg-yellow-400 hover:bg-yellow-500 px-3 py-1 rounded">Edit</button>
          </div>
        </>
      )}
    </div>
  ))}
</div>
      <button
  onClick={() => setShowEmergency(true)}
  className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold mb-4"
>
  🚨 Low Sugar Emergency
</button>
      {/* 🚨 REMINDER MODAL */}
      {activeReminder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center w-96">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              {activeReminder.type === "time" ? "⏰ Medication Time!" : "⚠ Stock Running Low!"}
            </h2>
            <p className="text-lg text-gray-700 mb-4">
              {activeReminder.type === "time"
                ? `Please take your ${activeReminder.medicineName}.`
                : `Enter tablets taken for ${activeReminder.medicineName}`}
            </p>
            {activeReminder.mealTiming && (
  <p className="text-sm text-gray-600">
    👉 Take {activeReminder.mealTiming}
  </p>
)}
            {activeReminder.type === "stock" && (
              <input
            type="number"
            value={takenQty}
            min="1"
            max={activeReminder?.totalTablets || 1}
            onChange={(e) => setTakenQty(Number(e.target.value))}
            className="border p-2 rounded w-full mb-4"
/>
            )}

            <div className="flex justify-center gap-4">
              <button
              onClick={() => {
               if (activeReminder.type === "stock") {
                 handleStockUpdate(activeReminder);
              } else {
                markTaken(activeReminder);
    }
  }}
>
  Taken
</button>
              <button onClick={() => setActiveReminder(null)} className="bg-gray-400 text-white px-6 py-2 rounded-xl font-bold">Close</button>
            </div>
          </div>
        </div>
      )}
      <UsageChart />
    </div>
  );
}

export default Dashboard;