import { useEffect, useState } from "react";
import API from "../services/api";
import { speakReminder } from "../utils/voice";
import { translations } from "../utils/translations";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import UsageChart from "../components/UsageChart";

let triggeredCache = {};

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
    injectionSite: "",
    mealTiming: ""
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
  const [showEmergency, setShowEmergency] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [takenQty, setTakenQty] = useState(1);
  const [extractedQueue, setExtractedQueue] = useState([]);
  const [stats, setStats] = useState({ taken: 0, missed: 0, adherence: 0 });
  const [snoozedMeds, setSnoozedMeds] = useState({});
  const [loggedToday, setLoggedToday] = useState({});
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const navigate = useNavigate();

  const t = translations[language] || translations["en-US"];

  const userStr = localStorage.getItem("user");
  let emergencyContact = "1234567890";
  let glucoseLevel = null;
  let stockReminderTime = null;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u && u.emergencyContact) emergencyContact = u.emergencyContact;
      if (u && u.glucoseLevel) glucoseLevel = u.glucoseLevel;
      if (u && u.stockReminderTime) stockReminderTime = u.stockReminderTime;
    } catch (e) { }
  }

  useEffect(() => {
    const stored = localStorage.getItem("extractedMeds");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data && data.length > 0) {
          setExtractedQueue(data);
          setQueueIndex(0);
          setForm(data[0]);
          setShowAddModal(true);
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
      setExtractedQueue([]);
      setQueueIndex(0);
      localStorage.removeItem("extractedMeds");
      resetForm();
      setShowAddModal(false);
      return;
    }
    setQueueIndex(nextIndex);
    setForm(extractedQueue[nextIndex]);
  };

  const resetForm = () => {
    setForm({
      medicineName: "", dosage: "", instructions: "", reminderTime: "",
      totalTablets: "", tabletsPerDose: "", dosesPerDay: "", lowStockThreshold: "",
      injectionSite: "", mealTiming: ""
    });
  };

  useEffect(() => {
    if (activeReminder) return;
    const interval = setInterval(() => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();

      medications.forEach((med) => {
        if (med.reminderTime) {
          const [hh, mm] = med.reminderTime.split(":");
          const timeKey = med._id + "time" + h + m;
          // Exact time trigger
          if (Number(hh) === h && Number(mm) === m && !triggeredCache[timeKey]) {
            triggeredCache[timeKey] = true;
            triggerReminder(med, "time");
          }
          // 10-Minute Snooze Trigger
          if (snoozedMeds[med._id] && now.getTime() >= snoozedMeds[med._id]) {
            setSnoozedMeds(prev => { const copy = { ...prev }; delete copy[med._id]; return copy; });
            triggerReminder(med, "time");
          }
        }

        // Check low stock
        if (Number(med.totalTablets) <= Number(med.lowStockThreshold)) {
          const stockKey = med._id + "stock" + h + m;
          let shouldTrigger = false;
          if (stockReminderTime) {
            const [sh, sm] = stockReminderTime.split(":");
            if (Number(sh) === h && Number(sm) === m) shouldTrigger = true;
          } else {
            if ((h === 9 || h === 14 || h === 19) && m === 0) shouldTrigger = true;
          }

          if (shouldTrigger && !triggeredCache[stockKey]) {
            triggeredCache[stockKey] = true;
            triggerReminder(med, "stock");
          }
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [medications, activeReminder, snoozedMeds]);

  const triggerReminder = (med, type) => {
    if (activeReminder) return;
    setActiveReminder({ ...med, type });
    setTakenQty(med.tabletsPerDose || 1);

    if (type === "time") {
      speakReminder(med.medicineName, language, "time");
      if (Notification.permission === "granted") {
        new Notification(t.medTimeAlert, { body: `${t.medTimeMsg} ${med.medicineName}`, icon: '/vite.svg' });
      }
      setSnoozedMeds(prev => ({ ...prev, [med._id]: Date.now() + 10 * 60 * 1000 }));
    } else if (type === "stock") {
      speakReminder(med.medicineName, language, "stock");
      if (Notification.permission === "granted") {
        new Notification(t.stockAlertTitle, { body: `${t.stockAlertMsg} ${med.medicineName}`, icon: '/vite.svg' });
      }
    }

    const timer = setTimeout(() => setActiveReminder(null), 5 * 60 * 1000);
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

  const handleAdd = async () => {
    if (!form.medicineName || !form.reminderTime || !form.dosage) {
      return alert("Please fill out at least the Medicine Name, Dosage, and Reminder Time!");
    }
    try {
      await API.post("/medications", {
        ...form,
        totalTablets: Number(form.totalTablets || 0),
        tabletsPerDose: Number(form.tabletsPerDose || 1),
        dosesPerDay: Number(form.dosesPerDay || 1),
        lowStockThreshold: Number(form.lowStockThreshold || 5)
      });
      if (extractedQueue.length > 0) {
        handleNextInQueue();
      } else {
        resetForm();
        setShowAddModal(false);
      }
      fetchMeds();
      fetchStats();
    } catch (error) {
      console.error(error);
      alert("Save failed! " + (error.response?.data?.message || "Check your details."));
    }
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
      setEditingId(null);
      fetchMeds();
      fetchStats();
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const markTaken = async (med) => {
    if (loggedToday[med._id]) {
      alert("You have already logged this medication session!");
      return;
    }
    if (Number(med.totalTablets) <= 0) {
      alert("No stock left! Please update inventory before logging.");
      return;
    }
    clearTimeout(repeatTimer);
    setActiveReminder(null);
    setSnoozedMeds(prev => { const copy = { ...prev }; delete copy[med._id]; return copy; });
    try {
      await API.post("/logs/taken", { medicationId: med._id });
      setTakenQty(1);
      setLoggedToday(prev => ({ ...prev, [med._id]: true }));
      fetchMeds();
      fetchStats();
    } catch (error) { console.error("Mark taken failed:", error); }
  };

  const handleStockUpdate = async (med) => {
    try {
      const quantity = Number(takenQty);
      if (!quantity || quantity <= 0) return;

      const updatedStock = Number(med.totalTablets) + quantity;

      await API.put(`/medications/${med._id}`, { ...med, totalTablets: updatedStock });

      setTakenQty(1);
      setActiveReminder(null);
      fetchMeds();
      fetchStats();
    } catch (error) { console.error("Stock update failed:", error); fetchMeds(); }
  };

  const startEdit = (med) => {
    setEditingId(med._id);
    setEditForm(med);
  };

  const markMissed = async (id, med) => {
    if (loggedToday[id]) {
      alert("You have already logged this medication session!");
      return;
    }
    // Requires med object to check stock
    if (med && Number(med.totalTablets) <= 0) {
      alert("No stock left! Please update inventory before logging.");
      return;
    }
    clearTimeout(repeatTimer);
    setActiveReminder(null);
    setSnoozedMeds(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    await API.post("/logs/missed", { medicationId: id });
    setLoggedToday(prev => ({ ...prev, [id]: true }));
    fetchMeds();
    fetchStats();
  };

  const handleLaterPopup = () => {
    if (activeReminder && activeReminder.type === "time") {
      setSnoozedMeds(prev => ({ ...prev, [activeReminder._id]: Date.now() + 10 * 60 * 1000 }));
    }
    setActiveReminder(null);
  };

  const renderInput = (stateMode, field, label, type = "text", wrapperClass = "col-span-1") => {
    const isEdit = stateMode === 'edit';
    const val = isEdit ? (editForm[field] || "") : (form[field] || "");
    const onChange = (e) => isEdit ? setEditForm({ ...editForm, [field]: e.target.value }) : setForm({ ...form, [field]: e.target.value });

    return (
      <div className={`flex flex-col space-y-1 ${wrapperClass}`}>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
        <input
          type={type}
          value={val}
          onChange={onChange}
          className="border-slate-200 bg-white/50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition shadow-sm"
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-end items-center gap-3 border-b border-slate-200/50 mb-4">
        <select
          className="bg-transparent text-sm font-semibold text-slate-500 outline-none hover:text-slate-800 transition cursor-pointer"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            localStorage.setItem("language", e.target.value);
          }}
        >
          <option value="en-US">🇺🇸 English</option>
          <option value="hi-IN">🇮🇳 Hindi</option>
          <option value="kn-IN">🇮🇳 Kannada</option>
          <option value="ta-IN">🇮🇳 Tamil</option>
        </select>
        <button onClick={() => navigate("/profile")} className="bg-white/80 backdrop-blur border border-slate-200 px-4 py-1.5 rounded-full text-sm font-bold text-slate-700 hover:text-indigo-600 hover:shadow-md transition flex items-center gap-2">
          👤 Profile
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{t.dashboardTitle1} <span className="text-gradient">{t.dashboardTitle2}</span></h1>
            <p className="text-slate-500 mt-2 font-medium">{t.dashboardSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowLowStockModal(true)} className="glass bg-orange-100/80 hover:bg-orange-200 text-orange-700 border-orange-200 px-5 py-2 rounded-full font-bold transition shadow-sm flex items-center gap-2">
              ⚠️ Low Stock
            </button>
            <button onClick={() => navigate("/upload")} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 px-5 py-2 rounded-full font-bold transition">
              {t.uploadBtn}
            </button>
            <button onClick={() => setShowAddModal(true)} className="glass bg-white hover:bg-indigo-50 text-indigo-700 px-5 py-2 rounded-full font-bold transition shadow-sm border border-indigo-100 flex items-center gap-2">
              <span className="text-xl leading-none -mt-1">+</span> {t.addMedTitle}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Stats & Active Meds */}
          <div className="col-span-2 space-y-8">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-xl"></div>
                <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider">{t.takenLabel}</h3>
                <p className="text-4xl font-black text-slate-800 mt-2">{stats.taken}</p>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-xl"></div>
                <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider">{t.missedLabel}</h3>
                <p className="text-4xl font-black text-slate-800 mt-2">{stats.missed}</p>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="glass p-6 rounded-2xl relative overflow-hidden bg-gradient-to-br from-indigo-500 to-blue-600 border-none shadow-lg shadow-indigo-500/20">
                <h3 className="text-white/80 font-bold uppercase text-xs tracking-wider">{t.adherenceLabel}</h3>
                <p className="text-4xl font-black text-white mt-2">{stats.adherence}%</p>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="glass p-6 rounded-2xl relative overflow-hidden bg-gradient-to-br from-cyan-500 to-teal-500 border-none shadow-lg shadow-cyan-500/20">
                <h3 className="text-white/80 font-bold uppercase text-xs tracking-wider">Glucose Level</h3>
                <p className="text-4xl font-black text-white mt-2">{glucoseLevel ? glucoseLevel : "--"}</p>
              </motion.div>
            </div>

            {/* Meds List */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{t.activeMedsTitle}</h2>
                <button onClick={() => setShowEmergency(true)} className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-1.5 rounded-full text-sm font-bold transition flex items-center gap-2">
                  <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>
                  {t.emergencyBtn}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <AnimatePresence>
                  {medications.length === 0 && (
                    <p className="text-slate-400 font-medium italic col-span-2">{t.emptyMeds}</p>
                  )}
                  {medications.map((med) => (
                    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} key={med._id} className="glass p-5 rounded-2xl hover:-translate-y-1 transition duration-300">
                      {editingId === med._id ? (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800">{t.editMedsTitle}</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {renderInput('edit', 'medicineName', 'Name')}
                            {renderInput('edit', 'dosage', 'Dosage')}
                            {renderInput('edit', 'reminderTime', 'Time', 'time')}
                            {renderInput('edit', 'totalTablets', 'Stock', 'number')}
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button onClick={handleUpdate} className="flex-1 bg-slate-900 text-white rounded-lg py-2 font-semibold hover:bg-slate-800 transition">{t.saveBtn}</button>
                            <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-200 text-slate-700 rounded-lg py-2 font-semibold hover:bg-slate-300 transition">{t.cancelBtn}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-extrabold text-xl text-slate-900">{med.medicineName}</h3>
                              <p className="text-indigo-600 font-semibold">
                                {med.dosage}{/^\d+(\.\d+)?$/.test(String(med.dosage).trim()) ? ' mg' : ''}
                                {med.tabletsPerDose ? ` (${med.tabletsPerDose} ${med.tabletsPerDose == 1 ? 'tablet' : 'tablets'})` : ''}
                                <span className="text-slate-400 font-normal"> at {med.reminderTime}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${med.totalTablets <= med.lowStockThreshold ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {med.totalTablets} {t.leftText}
                              </span>
                            </div>
                          </div>
                          {med.mealTiming && <p className="text-sm font-bold text-amber-600 mb-1">🍽️ {med.mealTiming}</p>}
                          {med.injectionSite && <p className="text-sm font-bold text-blue-600 mb-1">💉 {t.siteText} {med.injectionSite}</p>}
                          <p className="text-sm text-slate-500 mb-6">{med.instructions}</p>
                          <div className="flex gap-2">
                            <button onClick={() => markTaken(med)} disabled={loggedToday[med._id]} className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold shadow-sm transition ${loggedToday[med._id] ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}>{loggedToday[med._id] ? 'Logged' : t.takenLabel}</button>
                            <button onClick={() => markMissed(med._id, med)} disabled={loggedToday[med._id]} className={`flex-1 glass px-3 py-2 rounded-xl text-sm font-bold transition border-slate-200 ${loggedToday[med._id] ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'}`}>{t.skipBtn}</button>
                            <button onClick={() => startEdit(med)} className="w-[48px] glass bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center rounded-xl transition border-slate-200 text-xl">⚙️</button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Usage Chart */}
          <div className="space-y-6 w-full max-w-lg mx-auto lg:max-w-none">
            {/* Chart Wrapper */}
            <div className="glass p-6 rounded-3xl">
              <h2 className="font-bold mb-4 text-slate-800">{t.weeklyAdherenceTitle}</h2>
              <UsageChart key={stats.taken + stats.missed} />
            </div>

          </div>
        </div>
      </div>

      {/* Add Medication Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass bg-white p-6 sm:p-8 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto text-left shadow-2xl relative border-t-8 border-t-indigo-500">
              {/* Close Button */}
              <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                ✕
              </button>

              <div className="mb-6 pr-8">
                <h2 className="font-extrabold text-2xl text-slate-900">
                  {extractedQueue.length > 0 ? t.reviewScanned : t.addMedTitle}
                </h2>
                {extractedQueue.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full mt-2 inline-block">
                    {queueIndex + 1} of {extractedQueue.length}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderInput('add', 'medicineName', 'Name', 'text', 'md:col-span-2')}
                  {renderInput('add', 'dosage', 'Dosage')}
                  {renderInput('add', 'reminderTime', 'Time', 'time')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {renderInput('add', 'totalTablets', 'Stock', 'number')}
                  {renderInput('add', 'lowStockThreshold', 'Alert At', 'number')}
                  <div className="md:col-span-2 flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Meal Timing</label>
                    <select value={form.mealTiming || ""} onChange={(e) => setForm({ ...form, mealTiming: e.target.value })} className="border-slate-200 bg-white/50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition shadow-sm">
                      <option value="">No specific timing</option>
                      <option>Fasting (Empty Stomach)</option>
                      <option>Before Food</option>
                      <option>With Food</option>
                      <option>After Food</option>
                    </select>
                  </div>
                </div>

                {/* Optional Overrides */}
                <details className="text-sm text-slate-500 group cursor-pointer outline-none">
                  <summary className="font-semibold mb-2">{t.advancedDetails}</summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div className="flex flex-col space-y-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Injection Site</label>
                      <select value={form.injectionSite} onChange={(e) => setForm({ ...form, injectionSite: e.target.value })} className="border-slate-200 bg-white/50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition shadow-sm">
                        <option value="">None</option>
                        <option>Left Abdomen</option>
                        <option>Right Abdomen</option>
                        <option>Left Thigh</option>
                        <option>Right Thigh</option>
                        <option>Left Arm</option>
                        <option>Right Arm</option>
                      </select>
                    </div>

                    {renderInput('add', 'dosesPerDay', 'Freq/Day', 'number', 'col-span-1 md:col-span-2')}
                  </div>
                </details>

                <div className="flex gap-2 pt-4">
                  <button onClick={handleAdd} className="flex-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition">
                    {extractedQueue.length > 0 ? t.saveNextBtn : t.saveMedBtn}
                  </button>
                  {extractedQueue.length > 0 && (
                    <button onClick={handleNextInQueue} className="flex-1 w-full glass bg-white hover:bg-slate-100 text-slate-700 py-3 rounded-xl font-bold transition">{t.skipBtn}</button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Modal */}
      <AnimatePresence>
        {showEmergency && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-dark p-8 rounded-3xl w-full max-w-md text-center text-white border-rose-500/30">
              <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🚨</div>
              <h2 className="text-2xl font-black mb-4">{t.hypoTitle}</h2>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left mb-6">
                <p className="font-bold text-rose-300 mb-2 border-b border-white/10 pb-2">{t.hypoRule}</p>
                <ul className="text-sm space-y-2 text-slate-300">
                  <li><span className="text-white mr-2">1.</span>{t.hypoStep1}</li>
                  <li><span className="text-white mr-2">2.</span>{t.hypoStep2}</li>
                  <li><span className="text-white mr-2">3.</span>{t.hypoStep3}</li>
                  <li><span className="text-white mr-2">4.</span>{t.hypoStep4}</li>
                </ul>
              </div>
              <a href={`tel:${emergencyContact}`} className="block w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl mb-3 shadow-lg shadow-rose-500/30 transition">
                📞 {t.callEmergency}
              </a>
              <button onClick={() => setShowEmergency(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition">
                {t.dismissBtn}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder Modal */}
      <AnimatePresence>
        {activeReminder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-4 ${activeReminder.type === 'time' ? 'bg-indigo-100 text-indigo-500' : 'bg-orange-100 text-orange-500'}`}>
                {activeReminder.type === "time" ? "⏰" : "⚠️"}
              </div>
              <h2 className="text-3xl font-black mb-2 text-slate-800">
                {activeReminder.type === "time" ? t.medTimeAlert : t.stockAlertTitle}
              </h2>
              <p className="text-slate-600 text-lg font-medium mb-6">
                {activeReminder.type === "time" ? `${t.medTimeMsg} ${activeReminder.medicineName}.` : `${t.stockAlertMsg} ${activeReminder.medicineName}.`}
              </p>

              {activeReminder.type === "stock" && (
                <div className="mb-6 text-left">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t.refillAmount}</label>
                  <input type="number" value={takenQty} min="1" onChange={(e) => setTakenQty(Number(e.target.value))} className="w-full text-center text-2xl font-bold border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 rounded-xl p-3 outline-none" />
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { if (activeReminder.type === "stock") handleStockUpdate(activeReminder); else markTaken(activeReminder); }} className="flex-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition">
                  {t.confirmBtn}
                </button>
                <button onClick={handleLaterPopup} className="flex-1 w-full glass bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">
                  {t.laterBtn}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Low Stock Modal */}
      <AnimatePresence>
        {showLowStockModal && (
          <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{scale: 0.9, y: 20}} animate={{scale: 1, y: 0}} exit={{scale: 0.9, y: 20}} className="glass bg-white p-6 sm:p-8 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto text-left shadow-2xl relative border-t-8 border-t-orange-500">
              <button onClick={() => setShowLowStockModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                ✕
              </button>

              <div className="mb-6 pr-8">
                <div className="w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-2xl mb-3 shadow-inner">⚠️</div>
                <h2 className="font-extrabold text-2xl text-slate-900">Low Stock Alerts</h2>
                <p className="text-slate-500 font-medium mt-1">Review the medications that are currently running low on stock.</p>
              </div>

              <div className="space-y-4">
                {medications.filter(m => Number(m.totalTablets) <= Number(m.lowStockThreshold)).length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                    <span className="text-3xl block mb-2">🎉</span>
                    <h3 className="font-bold text-emerald-800">All Good!</h3>
                    <p className="text-emerald-600 font-medium">None of your medications are low on stock.</p>
                  </div>
                ) : (
                  medications.filter(m => Number(m.totalTablets) <= Number(m.lowStockThreshold)).sort((a, b) => Number(a.totalTablets) - Number(b.totalTablets)).map(med => (
                    <div key={med._id} className="border border-orange-200 bg-orange-50/50 rounded-2xl p-4 flex justify-between items-center sm:flex-row flex-col sm:items-center gap-4">
                      <div>
                        <h3 className="font-black text-slate-800 text-lg">{med.medicineName}</h3>
                        <p className="text-sm text-slate-500 font-medium">Dosage: <span className="text-slate-700">{med.dosage}</span></p>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-orange-100 sm:w-auto w-full text-center">
                        <p className="text-xs uppercase font-bold text-orange-400 mb-0.5">Remaining Stock</p>
                        <p className="text-xl font-black text-rose-600">{med.totalTablets} <span className="text-sm font-semibold text-rose-400">tablets</span></p>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;