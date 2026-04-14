import { useEffect, useState } from "react";
import API from "../services/api";
import { speakReminder } from "../utils/voice";
import { motion } from "framer-motion";

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
    lowStockThreshold: ""
  });

  const [queue, setQueue] = useState([]);
  const [medications, setMedications] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [language, setLanguage] = useState(
    localStorage.getItem("language") || "en-US"
  );

  const [activeReminder, setActiveReminder] = useState(null);
  const [repeatTimer, setRepeatTimer] = useState(null);
  const [triggeredStock, setTriggeredStock] = useState({});

  const [stats, setStats] = useState({
    taken: 0,
    missed: 0,
    adherence: 0
  });

  useEffect(() => {
  const stored = localStorage.getItem("extractedMeds");
  if (stored) {
    try {
      const data = JSON.parse(stored);
      if (data && data.length > 0) {
        setQueue(data);
        // Use a functional update to ensure we merge into the current state
        setForm(prevForm => ({
          ...prevForm,
          ...data[0] // This fills the medicineName, dosage, etc.
        }));
      }
    } catch (e) {
      console.error("Error parsing extracted meds", e);
    }
  }
  fetchMeds();
  fetchStats();
}, []);

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

        // ⏰ TIME REMINDER
        if (
          Number(hh) === h &&
          Number(mm) === m &&
          lastTriggered !== med._id + h + m
        ) {
          lastTriggered = med._id + m;
          triggerReminder(med, "time");
        }

        // ⚠ LOW STOCK
        if (
          med.totalTablets <= med.lowStockThreshold &&
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

  // ✅ TRIGGER REMINDER
  const triggerReminder = (med, type) => {
    if (activeReminder) return;

    setActiveReminder({ ...med, type });

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
    const token = localStorage.getItem("token");
    if (!token) return; 
    
    try {
        const res = await API.get("/medications");
        setMedications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
        console.error("Fetch Error:", err);
    }
  };

  const fetchStats = async () => {
    const res = await API.get("/logs");
    const logs = res.data;

    const taken = logs.filter(l => l.status === "Taken").length; // Fixed case sensitivity to match Schema
    const missed = logs.filter(l => l.status === "Missed").length;

    const adherence =
      taken + missed === 0
        ? 0
        : Math.round((taken / (taken + missed)) * 100);

    setStats({ taken, missed, adherence });
  };

  // ✅ ADD MEDICATION
  const handleAdd = async () => {
    await API.post("/medications", {
      ...form,
      totalTablets: Number(form.totalTablets),
      tabletsPerDose: Number(form.tabletsPerDose),
      dosesPerDay: Number(form.dosesPerDay),
      lowStockThreshold: Number(form.lowStockThreshold)
    });

    fetchMeds();

    const updated = queue.slice(1);
    setQueue(updated);

    if (updated.length > 0) setForm(updated[0]);
    else {
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
    }

    alert("Medication added");
  };

  // ✅ EDIT MEDICATION
  const startEdit = (med) => {
    setEditingId(med._id);
    setEditForm(med);
  };

  const handleUpdate = async () => {
    await API.put(`/medications/${editingId}`, {
      ...editForm,
      totalTablets: Number(editForm.totalTablets),
      tabletsPerDose: Number(editForm.tabletsPerDose),
      dosesPerDay: Number(editForm.dosesPerDay),
      lowStockThreshold: Number(editForm.lowStockThreshold)
    });

    setEditingId(null);
    fetchMeds();
  };

  // ✅ TAKEN (AUTOMATED - NO PROMPT)
  const markTaken = async (med) => {
    clearTimeout(repeatTimer);
    setActiveReminder(null);

    // Automatically uses tabletsPerDose from your model
    const doseAmount = med.tabletsPerDose || 1; 
    const updatedCount = Math.max(0, med.totalTablets - Number(doseAmount));

    try {
      await API.put(`/medications/${med._id}`, {
        ...med,
        totalTablets: updatedCount
      });

      await API.post("/logs/taken", {
        medicationId: med._id
      });

      fetchMeds();
      fetchStats();
    } catch (error) {
      console.error("Failed to mark as taken:", error);
    }
  };

  // ❌ MISSED
  const markMissed = async (id) => {
    clearTimeout(repeatTimer);
    setActiveReminder(null);

    await API.post("/logs/missed", { medicationId: id });

    const med = medications.find(m => m._id === id);

    setTimeout(() => {
      triggerReminder(med, "time");
    }, 5 * 60 * 1000);

    fetchStats();
  };

  const allowedFields = [
    "medicineName", "dosage", "instructions", "reminderTime", 
    "totalTablets", "tabletsPerDose", "dosesPerDay", "lowStockThreshold"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 p-6">
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

        <button
          onClick={() => (window.location.href = "/upload")}
          className="bg-purple-600 text-white px-3 py-2 rounded"
        >
          Upload Prescription
        </button>
      </div>

      <p className="text-red-500 mb-4">⚠ Reminder only. Follow doctor advice.</p>
{/* ✅ Ensure the TOP card looks like this: */}
<div className="bg-white p-4 rounded-xl shadow mb-6">
  <h2 className="font-bold mb-3">Add Medication</h2>
  <div className="grid md:grid-cols-2 gap-3">
    {allowedFields.map((field) => (
      <input
        key={field}
        placeholder={field}
        /* This line ensures extracted data from localStorage appears here */
        value={form[field] || ""} 
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        className="p-2 border rounded"
      />
    ))}
  </div>
  </div>

      {/* 📊 ANALYTICS */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Weekly Report</h2>
        <p>Taken: {stats.taken}</p>
        <p>Missed: {stats.missed}</p>
        <div className="w-full bg-gray-200 rounded h-4 mt-2">
          <div
            className="bg-green-500 h-4 rounded"
            style={{ width: `${stats.adherence}%` }}
          ></div>
        </div>
        <p className="mt-2 font-semibold">Adherence: {stats.adherence}%</p>
      </div>

      {/* 💊 MEDICATION LIST */}
      <div className="grid md:grid-cols-3 gap-4">
        {medications.map((med) => (
          <div key={med._id} className="bg-white p-4 rounded-xl shadow">
            {editingId === med._id ? (
              <>
                {allowedFields.map((field) => (
                  <input
                    key={field}
                    value={editForm[field] || ""}
                    onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                    className="p-2 border rounded mb-2 w-full"
                  />
                ))}
                <button
                  onClick={handleUpdate}
                  className="bg-green-500 text-white px-3 py-1 rounded"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg">{med.medicineName}</h3>
                <p>Dosage: {med.dosage}</p>
                <p>Time: {med.reminderTime?.slice(0, 5) || "-"}</p>
                <p>Stock: {med.totalTablets} tablets</p>

                {med.totalTablets <= med.lowStockThreshold && (
                  <p className="text-red-500 font-bold">⚠ Low Stock</p>
                )}

                <div className="flex gap-2 mt-4">
                  <button onClick={() => markTaken(med)} className="bg-green-500 text-white px-3 py-1 rounded">Taken</button>
                  <button onClick={() => markMissed(med._id)} className="bg-red-500 text-white px-3 py-1 rounded">Missed</button>
                  <button onClick={() => startEdit(med)} className="bg-yellow-400 px-3 py-1 rounded">Edit</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 🚨 MODAL POPUP */}
      {activeReminder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl text-center w-80">
            <h2 className="text-xl font-bold mb-2">
              {activeReminder.type === "time" ? "Medication Reminder" : "Low Stock Alert"}
            </h2>
            <p className="mb-4">
              {activeReminder.type === "time"
                ? `Take your ${activeReminder.medicineName}`
                : `Your ${activeReminder.medicineName} is running low!`}
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => markTaken(activeReminder)} className="bg-green-500 text-white px-4 py-2 rounded shadow">Taken</button>
              <button onClick={() => markMissed(activeReminder._id)} className="bg-red-500 text-white px-4 py-2 rounded shadow">Missed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;