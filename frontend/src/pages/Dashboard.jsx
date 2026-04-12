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
    const data = JSON.parse(localStorage.getItem("extractedMeds"));

    if (data && data.length > 0) {
      setQueue(data);
      setForm(data[0]);
    }

    fetchMeds();
    fetchStats();
  }, []);

  // ✅ REMINDER SYSTEM (FIXED PROPERLY)
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

  // ✅ TRIGGER (NO LOOP BUG)
  const triggerReminder = (med, type) => {
    if (activeReminder) return;

    setActiveReminder({ ...med, type });

    speakReminder(
      type === "time"
        ? med.medicineName
        : `${med.medicineName} is running low`,
      language
    );

    const timer = setTimeout(() => {
      setActiveReminder(null);
    }, 5 * 60 * 1000);

    setRepeatTimer(timer);
  };

  const fetchMeds = async () => {
    const res = await API.get("/medications");
    setMedications(res.data);
  };

  const fetchStats = async () => {
    const res = await API.get("/logs");
    const logs = res.data;

    const taken = logs.filter(l => l.status === "taken").length;
    const missed = logs.filter(l => l.status === "missed").length;

    const adherence =
      taken + missed === 0
        ? 0
        : Math.round((taken / (taken + missed)) * 100);

    setStats({ taken, missed, adherence });
  };

  // ✅ ADD
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
    else localStorage.removeItem("extractedMeds");

    alert("Medication added");
  };

  // ✅ EDIT
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

  // ✅ TAKEN (WITH TABLET INPUT)
  const markTaken = async (med) => {
    clearTimeout(repeatTimer);
    setActiveReminder(null);

    const tablets = prompt("How many tablets taken?");
    if (!tablets) return;

    const updatedCount =
      med.totalTablets - Number(tablets);

    await API.put(`/medications/${med._id}`, {
      ...med,
      totalTablets: updatedCount
    });

    await API.post("/logs/taken", {
      medicationId: med._id
    });

    fetchMeds();
    fetchStats();
  };

  // ❌ MISSED → REPEAT AFTER 5 MIN
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 p-6">

      <h1 className="text-3xl font-bold mb-4 text-blue-700">Dashboard</h1>

      {/* LANGUAGE */}
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

      <p className="text-red-500 mb-4">
        ⚠ Reminder only. Follow doctor advice.
      </p>

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

        <p className="mt-2 font-semibold">
          Adherence: {stats.adherence}%
        </p>
      </div>

      {/* ADD */}
      <motion.div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Add Medication</h2>

        <div className="grid md:grid-cols-2 gap-3">
          {Object.keys(form).map((field) => (
            <input
              key={field}
              placeholder={field}
              value={form[field]}
              onChange={(e) =>
                setForm({ ...form, [field]: e.target.value })
              }
              className="p-2 border rounded"
            />
          ))}
        </div>

        <button
          onClick={handleAdd}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Medication
        </button>
      </motion.div>

      {/* LIST */}
      <div className="grid md:grid-cols-3 gap-4">
        {medications.map((med) => (
          <div key={med._id} className="bg-white p-4 rounded-xl shadow">

            {editingId === med._id ? (
              <>
                const allowedFields = [
  "medicineName",
  "dosage",
  "instructions",
  "reminderTime",
  "totalTablets",
  "tabletsPerDose",
  "dosesPerDay",
  "lowStockThreshold"
];

{allowedFields.map((field) => (
  <input
    key={field}
    value={editForm[field]}
    onChange={(e) =>
      setEditForm({
        ...editForm,
        [field]: e.target.value
      })
    }
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
                <h3 className="font-bold">{med.medicineName}</h3>
                <p>Dosage: {med.dosage}</p>
                <p>
  Time: {
    med.reminderTime
      ? med.reminderTime.slice(0,5)
      : "-"
  }
</p>
                <p>Tablets: {med.totalTablets}</p>

                {med.totalTablets <= med.lowStockThreshold && (
                  <p className="text-red-500">⚠ Low Stock</p>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => markTaken(med)}
                    className="bg-green-500 text-white px-2 py-1 rounded"
                  >
                    Taken
                  </button>

                  <button
                    onClick={() => markMissed(med._id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Missed
                  </button>

                  <button
                    onClick={() => startEdit(med)}
                    className="bg-yellow-400 px-2 py-1 rounded"
                  >
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* MODAL */}
      {activeReminder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl text-center w-80">

            <h2 className="text-xl font-bold mb-2">
              {activeReminder.type === "time"
                ? "Medication Reminder"
                : "Low Stock Alert"}
            </h2>

            <p className="mb-4">
              {activeReminder.type === "time"
                ? `Take ${activeReminder.medicineName}`
                : `${activeReminder.medicineName} is low`}
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => markTaken(activeReminder)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow"
              >
                Taken
              </button>

              <button
                onClick={() => markMissed(activeReminder._id)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow"
              >
                Missed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;