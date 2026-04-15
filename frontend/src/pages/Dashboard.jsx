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
          const firstMed = data[0];// ✅ Merges extracted data into the form correctly
          setForm({
          medicineName: data[0].medicineName || "",
          dosage: data[0].dosage || "",
          instructions: data[0].instructions || "",
          reminderTime: data[0].reminderTime || "",
          totalTablets: data[0].totalTablets || "",
          tabletsPerDose: data[0].tabletsPerDose || "",
          dosesPerDay: data[0].dosesPerDay || "",
          lowStockThreshold: data[0].lowStockThreshold || ""
        });
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

        if (
          Number(hh) === h &&
          Number(mm) === m &&
          lastTriggered !== med._id + h + m
        ) {
          lastTriggered = med._id + m;
          triggerReminder(med, "time");
        }

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

    const taken = logs.filter(l => l.status === "Taken").length;
    const missed = logs.filter(l => l.status === "Missed").length;

    const adherence =
      taken + missed === 0
        ? 0
        : Math.round((taken / (taken + missed)) * 100);

    setStats({ taken, missed, adherence });
  };

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

  const markTaken = async (med) => {
    clearTimeout(repeatTimer);
    setActiveReminder(null);

    const doseAmount = med.tabletsPerDose || 1; 
    const updatedCount = Math.max(0, med.totalTablets - Number(doseAmount));

    try {
      await API.put(`/medications/${med._id}`, {
        ...med,
        totalTablets: updatedCount
      });

      await API.post("/logs/taken", { medicationId: med._id });

      fetchMeds();
      fetchStats();
    } catch (error) {
      console.error("Failed to mark as taken:", error);
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

      {/* ✅ ADD MEDICATION SECTION (ONLY ONE INSTANCE) */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3 text-lg">Add Medication</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {allowedFields.map((field) => (
            <input
              key={field}
              placeholder={field}
              // ✅ This ensures the extracted text appears in the input
              value={form[field] || ""} 
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="p-2 border rounded focus:ring-2 focus:ring-blue-400 outline-none"
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
        >
          Add Medication
        </button>
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
          <div key={med._id} className="bg-white p-4 rounded-xl shadow border-t-4 border-blue-500">
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
                  className="bg-green-500 text-white px-3 py-1 rounded w-full"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg text-gray-800">{med.medicineName}</h3>
                <p className="text-sm text-gray-600">Dosage: {med.dosage}</p>
                <p className="text-sm text-gray-600">Time: {med.reminderTime?.slice(0, 5) || "-"}</p>
                <p className="text-sm font-semibold mt-1">Stock: {med.totalTablets} left</p>

                {med.totalTablets <= med.lowStockThreshold && (
                  <p className="text-red-500 font-bold text-xs animate-pulse">⚠ Low Stock Alert</p>
                )}

                <div className="flex gap-2 mt-4">
                  <button onClick={() => markTaken(med)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded flex-1">Taken</button>
                  <button onClick={() => markMissed(med._id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded flex-1">Missed</button>
                  <button onClick={() => startEdit(med)} className="bg-yellow-400 hover:bg-yellow-500 px-3 py-1 rounded">Edit</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 🚨 REMINDER MODAL */}
      {activeReminder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center w-96">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              {activeReminder.type === "time" ? "⏰ Medication Time!" : "⚠ Stock Running Low!"}
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              {activeReminder.type === "time"
                ? `Please take your ${activeReminder.medicineName}.`
                : `Your supply of ${activeReminder.medicineName} is almost empty.`}
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => markTaken(activeReminder)} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl font-bold">Taken</button>
              <button onClick={() => markMissed(activeReminder._id)} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold">Missed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;