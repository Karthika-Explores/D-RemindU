/**
 * Dashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   This is the MAIN page of the RemindU app. It is what users see after
 *   they log in. It lets them:
 *     1. View all their active medications
 *     2. Mark doses as taken or skipped
 *     3. See daily/weekly statistics (taken, missed, adherence %)
 *     4. Add, edit, or delete medications
 *     5. Get reminder popups at the scheduled time
 *     6. See low-stock alerts
 *     7. Use an emergency hypoglycaemia guide
 *
 * HOW IT WORKS:
 *   - When the page loads, it fetches medications + logs from the backend API.
 *   - A background timer runs every 10 seconds to check if any medication
 *     reminder time has arrived.
 *   - When it has, a modal popup appears and optionally speaks the reminder.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── IMPORTS ──────────────────────────────────────────────────────────────────
// React core hooks:
//   useEffect  → run side effects (timers, API calls) after render
//   useState   → declare reactive state variables
//   useCallback → memoize a function so it is not recreated on every render
import { useEffect, useState, useCallback } from "react";

// Our custom Axios wrapper that automatically attaches auth tokens to requests
import API from "../services/api";

// Voice reminder — calls the browser's text-to-speech engine
import { speakReminder } from "../utils/voice";

// Multi-language string lookup (English, Hindi, Kannada, Tamil)
import { translations } from "../utils/translations";

// Web Push Notification helper — registers the browser for background alerts
import { subscribeToPushNotifications } from "../services/pushService";

// framer-motion: adds smooth enter/exit animations and layout transitions
// eslint-disable-next-line no-unused-vars -- `motion` IS used as a JSX namespace: <motion.div>
import { motion, AnimatePresence } from "framer-motion";

// React Router hook to programmatically navigate to another page
import { useNavigate } from "react-router-dom";

// Our chart component that shows the 7-day medication activity graph
import UsageChart from "../components/UsageChart";

// ── MODULE-LEVEL CACHE ────────────────────────────────────────────────────────
// `triggeredCache` lives OUTSIDE the component so it is never reset on re-render.
// It tracks which reminders have already fired today so we don't trigger twice.
// Key format: "<medicationId>time<timeString><hour><minute>"
let triggeredCache = {};

function Dashboard() {

  // ── STATE: ADD MEDICATION FORM ─────────────────────────────────────────────
  // Holds the values typed into the "Add Medication" form fields.
  // Each key matches a field in the MongoDB medication document.
  // If redirected from Upload page with scanned meds, prefill with first item.
  const [form, setForm] = useState(() => {
    try {
      const stored = localStorage.getItem("extractedMeds");
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data) && data.length > 0) return data[0];
      }
    } catch { /* ignore */ }
    return {
      medicineName: "",        // e.g. "Metformin"
      dosage: "",              // e.g. "500 mg"
      instructions: "",       // e.g. "Take with food"
      reminderTime: "",       // comma-separated times, e.g. "08:00,14:00"
      totalTablets: "",       // current stock count
      tabletsPerDose: "",     // how many tablets per single dose
      dosesPerDay: "",        // how many doses per day
      lowStockThreshold: "",  // alert when stock drops below this number
      injectionSite: "",      // for insulin: Left Abdomen, Right Thigh, etc.
      mealTiming: ""          // Before Food / After Food / Fasting
    };
  });

  // ── STATE: MEDICATIONS LIST ────────────────────────────────────────────────
  // Array of medication objects fetched from the backend
  const [medications, setMedications] = useState([]);

  // ── STATE: EDITING ─────────────────────────────────────────────────────────
  // Which medication card is currently in edit mode (stores its _id string)
  const [editingId, setEditingId] = useState(null);
  // A copy of the medication being edited — changes here don't affect the list
  // until the user saves
  const [editForm, setEditForm] = useState({});

  // ── STATE: LANGUAGE ────────────────────────────────────────────────────────
  // The currently selected UI language code, e.g. "en-US", "hi-IN"
  // We persist it to localStorage so it survives a page refresh
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");

  // ── STATE: SCANNED PRESCRIPTION QUEUE ─────────────────────────────────────
  // When the user uploads a prescription image, the OCR extracts multiple meds.
  // This array holds all of them; queueIndex tracks which one we are reviewing.
  const [queueIndex, setQueueIndex] = useState(0);

  // ── STATE: REMINDER POPUP ──────────────────────────────────────────────────
  // When it is time to take a medication, we store the med object here.
  // The reminder modal reads from this state to know what to show.
  const [activeReminder, setActiveReminder] = useState(null);
  // Timer ID for the auto-dismiss timeout (5 min). Stored so we can cancel it.
  const [repeatTimer, setRepeatTimer] = useState(null);

  // ── STATE: MODALS ──────────────────────────────────────────────────────────
  const [showEmergency, setShowEmergency] = useState(false);   // Emergency guide modal
  const [showAddModal, setShowAddModal] = useState(() => {
    try {
      const stored = localStorage.getItem("extractedMeds");
      if (stored) {
        const data = JSON.parse(stored);
        return Array.isArray(data) && data.length > 0;
      }
    } catch { /* ignore */ }
    return false;
  });      // Add medication modal
  const [showLowStockModal, setShowLowStockModal] = useState(false); // Low stock list

  // ── STATE: STOCK REFILL ────────────────────────────────────────────────────
  // How many tablets the user wants to add during a stock-refill reminder
  const [takenQty, setTakenQty] = useState(1);

  // ── STATE: SCANNED MED QUEUE ───────────────────────────────────────────────
  const [extractedQueue, setExtractedQueue] = useState(() => {
    try {
      const stored = localStorage.getItem("extractedMeds");
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch { /* ignore */ }
    return [];
  });

  // ── STATE: STATISTICS ─────────────────────────────────────────────────────
  // Computed from the logs API: total taken, total missed, adherence percentage
  const [stats, setStats] = useState({ taken: 0, missed: 0, adherence: 0 });

  // ── STATE: SNOOZE MAP ─────────────────────────────────────────────────────
  // Maps medicationId → timestamp when the snooze expires
  // e.g. { "abc123": 1727600000000 } means "remind again at that unix time"
  const [snoozedMeds, setSnoozedMeds] = useState({});

  // ── STATE: TODAY'S LOG COUNT ───────────────────────────────────────────────
  // Maps medicationId → how many times the user has logged it TODAY.
  // Used to show "Logged" on buttons and disable re-logging.
  const [loggedToday, setLoggedToday] = useState({});

  // ── STATE: LIVE CLOCK ─────────────────────────────────────────────────────
  // Updated every 60 seconds so the greeting banner and schedule strip stay fresh
  const [currentTime, setCurrentTime] = useState(new Date());

  // useNavigate gives us a function to redirect to another page programmatically
  const navigate = useNavigate();

  // `t` is the translations object for the active language.
  // e.g. t.dashboardTitle1, t.addMedTitle, etc.
  const t = translations[language] || translations["en-US"];

  // ── CLOCK: Update `currentTime` every 60 seconds ─────────────────────────
  // setInterval calls a function repeatedly on a set delay (in milliseconds).
  // Here we update `currentTime` every 60 000 ms = 1 minute.
  // The cleanup function (return) clears the interval when the component unmounts
  // to prevent memory leaks.
  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(tick); // Cleanup when component unmounts
  }, []);

  // ── HELPER: Find the next upcoming medication reminder ─────────────────────
  // Scans all medications and returns the one whose reminder time is
  // closest in the future (relative to `currentTime`).
  // Returns: { name, time, minsAway } or null if no future reminders today.
  //
  // useCallback is used here so this function is only recreated when
  // `medications` or `currentTime` changes — a small performance optimisation.
  const getNextReminder = useCallback(() => {
    const now = currentTime;
    // Convert current time to total minutes since midnight for easy comparison
    const nowMins = now.getHours() * 60 + now.getMinutes();
    let nearest = null;
    let nearestMins = Infinity; // Start with "infinitely far away"

    medications.forEach(med => {
      if (!med.reminderTime) return; // Skip meds with no reminder set
      // reminderTime can be "08:00" or "08:00,14:00,20:00" (comma-separated)
      String(med.reminderTime).split(",").forEach(t => {
        const [hh, mm] = (t.trim()).split(":").map(Number);
        if (isNaN(hh) || isNaN(mm)) return; // Skip malformed times
        const medMins = hh * 60 + mm;
        const diff = medMins - nowMins; // Minutes until this reminder
        // Only consider future reminders (diff > 0)
        if (diff > 0 && diff < nearestMins) {
          nearestMins = diff;
          nearest = { name: med.medicineName, time: t.trim(), minsAway: diff };
        }
      });
    });
    return nearest; // Returns null if there are no future reminders today
  }, [medications, currentTime]);

  // ── HELPER: Return a greeting based on the current hour ───────────────────
  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  // ── HELPER: Get the user's first name from localStorage ───────────────────
  // localStorage.getItem("user") returns a JSON string saved at login.
  // We parse it and grab the first word of the name field.
  const userName = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u.name?.split(" ")[0] || "there"; // Fallback to "there" if no name
    } catch {
      return "there";
    }
  })();

  // ── USER PROFILE DATA ──────────────────────────────────────────────────────
  // Read additional profile fields from localStorage that were stored at login.
  const userStr = localStorage.getItem("user");
  let emergencyContact = "1234567890"; // Default contact if user hasn't set one
  let glucoseLevel = null;             // Optional blood glucose reading from profile
  let stockReminderTime = null;        // Custom time for low-stock alerts (e.g. "09:00")
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u && u.emergencyContact) emergencyContact = u.emergencyContact;
      if (u && u.glucoseLevel)     glucoseLevel     = u.glucoseLevel;
      if (u && u.stockReminderTime) stockReminderTime = u.stockReminderTime;
    } catch { /* silently ignore JSON parse errors */ }
  }

  // ── fetchMeds: Load all medications from the backend ─────────────────────
  // GET /medications → returns the user's saved medications as a JSON array
  const fetchMeds = async () => {
    try {
      const res = await API.get("/medications");
      // Guard: ensure the response is an array before updating state
      setMedications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  // ── fetchStats: Compute statistics from the medication logs ───────────────
  // GET /logs → returns all log entries (each has a status: "Taken" or "Missed")
  // We count each, compute adherence %, and build a per-medication daily log map.
  const fetchStats = async () => {
    try {
      const res = await API.get("/logs");
      const logs = res.data || [];

      // Count how many logs are "taken" vs anything else (missed)
      const taken  = logs.filter(l => l.status === "Taken"  || l.status === "taken").length;
      const missed = logs.filter(l => l.status === "Missed" || l.status === "missed").length;

      // Adherence = taken / (taken + missed) * 100, rounded to nearest integer
      // Guard against division by zero when no logs exist yet
      const adherence = (taken + missed === 0) ? 0 : Math.round((taken / (taken + missed)) * 100);
      setStats({ taken, missed, adherence });

      // Build loggedToday — a map of medicationId → how many times logged today
      // This prevents showing "Take" on a button that's already been logged today
      const today = new Date().toDateString(); // e.g. "Mon Sep 29 2026"
      const currentAuthLogs = {};
      logs.forEach(l => {
        const logDate = l.date || l.createdAt;
        if (logDate && new Date(logDate).toDateString() === today) {
          // Increment the count for this medication
          currentAuthLogs[l.medicationId] = (currentAuthLogs[l.medicationId] || 0) + 1;
        }
      });
      setLoggedToday(currentAuthLogs);

    } catch (err) {
      console.error("Stats error:", err);
    }
  };

  // ── triggerReminder: Show the reminder modal and optionally speak ──────────
  // Called when a scheduled time matches or a snooze ends.
  // `type` is either "time" (dose reminder) or "stock" (low-stock refill).
  // Wrapped in useCallback so the background-timer useEffect dep array stays stable.
  const triggerReminder = useCallback((med, type) => {
    if (activeReminder) return; // Don't stack multiple modals

    setActiveReminder({ ...med, type }); // Store the medication + type in state
    setTakenQty(med.tabletsPerDose || 1); // Pre-fill quantity with default dose

    if (type === "time") {
      // Use the browser's text-to-speech to announce the reminder
      speakReminder(med.medicineName, language, "time");

      // Send a browser notification (only if the user granted permission)
      if (Notification.permission === "granted") {
        new Notification(t.medTimeAlert, {
          body: `${t.medTimeMsg} ${med.medicineName}`,
          icon: '/vite.svg'
        });
      }

      // Auto-re-remind in 10 minutes (snooze by default)
      setSnoozedMeds(prev => ({ ...prev, [med._id]: Date.now() + 10 * 60 * 1000 }));

    } else if (type === "stock") {
      speakReminder(med.medicineName, language, "stock");
      if (Notification.permission === "granted") {
        new Notification(t.stockAlertTitle, {
          body: `${t.stockAlertMsg} ${med.medicineName}`,
          icon: '/vite.svg'
        });
      }
    }

    // Auto-close the modal after 5 minutes if the user ignores it
    const timer = setTimeout(() => setActiveReminder(null), 5 * 60 * 1000);
    setRepeatTimer(timer);
  }, [activeReminder, language, t]);

  // ── ON MOUNT: Load extracted medications + fetch data ─────────────────────
  // This runs exactly once when Dashboard first appears.
  // It checks if the Upload page stored scanned meds in localStorage,
  // then fetches medications and stats from the backend.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeds();  // Load user's medications from backend
    fetchStats(); // Load log data and calculate stats

    // Register the browser for Web Push Notifications
    // (asks for permission and saves the subscription to the backend)
    subscribeToPushNotifications();
  }, []); // Empty array = run only once on mount

  // ── QUEUE: Move to the next scanned medication ─────────────────────────────
  // Called when the user clicks "Skip" or "Next" in the scanned prescription flow.
  // If there are no more medications in the queue, close the modal and clean up.
  const handleNextInQueue = () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex >= extractedQueue.length) {
      // All scanned meds have been reviewed — clean up
      setExtractedQueue([]);
      setQueueIndex(0);
      localStorage.removeItem("extractedMeds"); // Remove from storage
      resetForm();
      setShowAddModal(false);
      return;
    }
    // Move to the next scanned medication
    setQueueIndex(nextIndex);
    setForm(extractedQueue[nextIndex]);
  };

  // ── HELPER: Reset the Add Medication form to blank ────────────────────────
  const resetForm = () => {
    setForm({
      medicineName: "", dosage: "", instructions: "", reminderTime: "",
      totalTablets: "", tabletsPerDose: "", dosesPerDay: "", lowStockThreshold: "",
      injectionSite: "", mealTiming: ""
    });
  };

  // ── BACKGROUND TIMER: Check for reminders every 10 seconds ────────────────
  // This is the heart of the reminder system.
  // setInterval runs the callback function every 10 000 ms (10 seconds).
  // Each tick it:
  //   1. Checks if the current HH:MM matches any medication's reminder time.
  //   2. Checks if any snoozed medication's snooze period has expired.
  //   3. Checks if any low-stock medication needs a stock alert.
  // The `triggeredCache` object prevents the same reminder firing more than once.
  useEffect(() => {
    if (activeReminder) return; // Don't start the interval if a modal is already open

    const interval = setInterval(() => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();

      medications.forEach((med) => {
        if (med.reminderTime) {
          // Split comma-separated times: "08:00,14:00" → ["08:00", "14:00"]
          const times = String(med.reminderTime || "").split(",").map(t => t.trim());

          times.forEach(timeStr => {
            if (!timeStr) return;
            const [hh, mm] = timeStr.split(":");
            // Build a unique cache key so we only fire this reminder once per minute
            const timeKey = med._id + "time" + timeStr + h + m;
            // Exact time trigger — fires if current time matches the reminder time
            if (Number(hh) === h && Number(mm) === m && !triggeredCache[timeKey]) {
              triggeredCache[timeKey] = true; // Mark as triggered
              triggerReminder(med, "time");   // Show the popup
            }
          });

          // Snooze Trigger — fires if the snooze countdown has elapsed
          if (snoozedMeds[med._id] && now.getTime() >= snoozedMeds[med._id]) {
            // Remove from snoozed map
            setSnoozedMeds(prev => { const copy = { ...prev }; delete copy[med._id]; return copy; });
            triggerReminder(med, "time");
          }
        }

        // ── Low Stock Alert ────────────────────────────────────────────────
        // If stock is at or below the threshold, trigger a stock reminder.
        if (Number(med.totalTablets) <= Number(med.lowStockThreshold)) {
          const stockKey = med._id + "stock" + h + m;
          let shouldTrigger = false;

          if (stockReminderTime) {
            // Use the user's custom stock alert time from their profile
            const [sh, sm] = stockReminderTime.split(":");
            if (Number(sh) === h && Number(sm) === m) shouldTrigger = true;
          } else {
            // Default: alert at 9am, 2pm, and 7pm
            if ((h === 9 || h === 14 || h === 19) && m === 0) shouldTrigger = true;
          }

          if (shouldTrigger && !triggeredCache[stockKey]) {
            triggeredCache[stockKey] = true;
            triggerReminder(med, "stock");
          }
        }
      });
    }, 10000); // Run every 10 seconds

    return () => clearInterval(interval); // Cleanup on unmount or dependency change
  }, [medications, activeReminder, snoozedMeds, stockReminderTime, triggerReminder]);

  // ── handleAdd: Save a new medication to the database ─────────────────────
  // Validates required fields, then POSTs the form data to /medications.
  // If we are in "queue mode" (scanned prescription), moves to the next item.
  const handleAdd = async () => {
    // Basic validation — these three fields are mandatory
    if (!form.medicineName || !form.reminderTime || !form.dosage) {
      return alert("Please fill out at least the Medicine Name, Dosage, and Reminder Time!");
    }
    try {
      await API.post("/medications", {
        ...form,
        // Convert string inputs to numbers with safe defaults
        totalTablets:      Number(form.totalTablets      || 0),
        tabletsPerDose:    Number(form.tabletsPerDose    || 1),
        dosesPerDay:       Number(form.dosesPerDay       || 1),
        lowStockThreshold: Number(form.lowStockThreshold || 5)
      });

      if (extractedQueue.length > 0) {
        handleNextInQueue(); // In queue mode: move to the next scanned med
      } else {
        resetForm();
        setShowAddModal(false); // Close modal and clear form
      }

      fetchMeds();  // Refresh the list so the new med appears immediately
      fetchStats(); // Recalculate stats
    } catch (error) {
      console.error(error);
      alert("Save failed! " + (error.response?.data?.message || "Check your details."));
    }
  };

  // ── handleUpdate: Save edits to an existing medication ────────────────────
  // Uses editingId (the MongoDB _id) to PUT updated data to the server.
  const handleUpdate = async () => {
    try {
      await API.put(`/medications/${editingId}`, {
        ...editForm,
        totalTablets:      Number(editForm.totalTablets),
        tabletsPerDose:    Number(editForm.tabletsPerDose),
        dosesPerDay:       Number(editForm.dosesPerDay),
        lowStockThreshold: Number(editForm.lowStockThreshold)
      });
      setEditingId(null); // Exit edit mode
      fetchMeds();
      fetchStats();
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  // ── handleDelete: Permanently remove a medication ─────────────────────────
  // Shows a confirmation dialog before sending the DELETE request.
  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteConfirm || "Are you sure you want to delete this medication?")) return;
    try {
      await API.delete(`/medications/${id}`);
      setEditingId(null);
      fetchMeds();
      fetchStats();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // ── markTaken: Log a medication as TAKEN ──────────────────────────────────
  // Guards:
  //   1. Can't log more times than dosesPerDay
  //   2. Can't log if stock is 0
  // After logging, deducts 1 tablet from stock (handled server-side via /logs/taken)
  const markTaken = async (med) => {
    const doses        = Number(med.dosesPerDay) || 1;
    const currentCount = loggedToday[med._id] || 0;

    // Guard: already logged all doses for today
    if (currentCount >= doses) {
      alert("You have already logged all medication sessions for today!");
      return;
    }
    // Guard: no stock remaining
    if (Number(med.totalTablets) <= 0) {
      alert("No stock left! Please update inventory before logging.");
      return;
    }

    clearTimeout(repeatTimer);   // Cancel the auto-dismiss timer
    setActiveReminder(null);     // Close the reminder modal
    // Remove this med from the snooze map
    setSnoozedMeds(prev => { const copy = { ...prev }; delete copy[med._id]; return copy; });

    try {
      await API.post("/logs/taken", { medicationId: med._id });
      setTakenQty(1);
      // Increment the local counter immediately (no need to re-fetch)
      setLoggedToday(prev => ({ ...prev, [med._id]: (prev[med._id] || 0) + 1 }));
      fetchMeds();  // Refresh to get updated totalTablets count
      fetchStats();
    } catch (error) { console.error("Mark taken failed:", error); }
  };

  // ── handleStockUpdate: Add tablets to a medication's stock ────────────────
  // Called when the user confirms a stock refill via the reminder modal.
  const handleStockUpdate = async (med) => {
    try {
      const quantity = Number(takenQty);
      if (!quantity || quantity <= 0) return; // Invalid quantity — do nothing

      const updatedStock = Number(med.totalTablets) + quantity; // New total
      await API.put(`/medications/${med._id}`, { ...med, totalTablets: updatedStock });

      setTakenQty(1);
      setActiveReminder(null); // Close the modal
      fetchMeds();
      fetchStats();
    } catch (error) { console.error("Stock update failed:", error); fetchMeds(); }
  };

  // ── startEdit: Enter edit mode for a medication card ──────────────────────
  // Copies the medication data into editForm so we can modify it without
  // immediately changing the real list.
  const startEdit = (med) => {
    setEditingId(med._id);  // Mark which card is being edited
    setEditForm(med);       // Fill the edit form with existing values
  };

  // ── markMissed: Log a medication dose as SKIPPED / MISSED ─────────────────
  const markMissed = async (id, med) => {
    const doses        = med ? (Number(med.dosesPerDay) || 1) : 1;
    const currentCount = loggedToday[id] || 0;

    if (currentCount >= doses) {
      alert("You have already logged all medication sessions for today!");
      return;
    }
    if (med && Number(med.totalTablets) <= 0) {
      alert("No stock left! Please update inventory before logging.");
      return;
    }

    clearTimeout(repeatTimer);
    setActiveReminder(null);
    setSnoozedMeds(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    await API.post("/logs/missed", { medicationId: id });
    setLoggedToday(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    fetchMeds();
    fetchStats();
  };

  // ── handleLaterPopup: Dismiss the reminder and snooze for 10 minutes ──────
  const handleLaterPopup = () => {
    if (activeReminder && activeReminder.type === "time") {
      // Re-schedule reminder for 10 minutes from now
      setSnoozedMeds(prev => ({ ...prev, [activeReminder._id]: Date.now() + 10 * 60 * 1000 }));
    }
    setActiveReminder(null); // Close the modal
  };

  // ── renderInput: Reusable form field renderer ─────────────────────────────
  // Creates a labelled text/number input that binds to either the `form` state
  // (add mode) or `editForm` state (edit mode) based on the `stateMode` arg.
  //
  // Parameters:
  //   stateMode    → 'add' or 'edit'
  //   field        → which property to read/write (e.g. 'medicineName')
  //   label        → the visible label text
  //   type         → HTML input type ('text' or 'number')
  //   wrapperClass → extra CSS class for the wrapping div (for grid spanning)
  const renderInput = (stateMode, field, label, type = "text", wrapperClass = "col-span-1") => {
    const isEdit = stateMode === 'edit';
    const val      = isEdit ? (editForm[field] || "") : (form[field] || "");
    const onChange = (e) => isEdit
      ? setEditForm({ ...editForm, [field]: e.target.value })
      : setForm({    ...form,     [field]: e.target.value });

    return (
      <div className={`flex flex-col space-y-1 ${wrapperClass}`}>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
        <input
          type={type}
          value={val}
          onChange={onChange}
          className="border-slate-200 bg-white/50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 rounded-lg p-2.5 outline-none transition shadow-sm w-full"
        />
      </div>
    );
  };

  // ── renderTimeInputs: Renders one time-picker per dose per day ────────────
  // If dosesPerDay = 3, this renders 3 separate <input type="time"> fields.
  // All three values are joined as a comma-separated string in reminderTime.
  // Max doses capped at 6 to keep the UI manageable.
  const renderTimeInputs = (stateMode) => {
    const isEdit     = stateMode === 'edit';
    const formState  = isEdit ? editForm : form;
    const setFormState = isEdit ? setEditForm : setForm;
    let doses = Number(formState.dosesPerDay) || 1;
    if (doses < 1) doses = 1;
    if (doses > 6) doses = 6; // Cap at 6 doses per day

    // Parse existing reminderTime string into an array of time strings
    const times = (formState.reminderTime || "").split(",").map(s => s.trim());

    return (
      <div className="flex flex-col space-y-1 col-span-2 sm:col-span-1 md:col-span-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reminder Times ({doses} Doses)</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Create one time picker for each dose */}
          {Array.from({ length: doses }).map((_, i) => (
             <input
               key={i}
               type="time"
               value={times[i] || ""}
               onChange={(e) => {
                 const newTimes = [...times];
                 newTimes[i] = e.target.value;
                 // Rejoin all times into a single comma-separated string
                 setFormState({...formState, reminderTime: newTimes.join(",")});
               }}
               className="border-slate-200 bg-white/50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 rounded-lg p-2 outline-none transition shadow-sm w-full text-sm"
               required
             />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #f8f6ff 30%, #eef9f4 60%, #f0f4ff 100%)' }}>
      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-violet-400/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-32 left-1/3 w-[450px] h-[450px] bg-teal-400/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/4 left-1/2 w-[300px] h-[300px] bg-blue-300/8 rounded-full blur-[80px]"></div>
      </div>
      <div className="relative z-10">
      {/* Top Navigation Bar with Emergency, Medication, Profile, and Language */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/60 shadow-xs mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-base shadow-sm font-black">
              💊
            </div>
            <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight hidden sm:inline">
              Remind<span className="text-indigo-600">U</span>
            </span>
          </div>

          {/* Right: Emergency Button, Medication Button, Profile Button, Language Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-nowrap flex-shrink-0">
            {/* Language Selector */}
            <select
              className="h-[38px] bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 px-2 sm:px-3 outline-none transition cursor-pointer flex-shrink-0"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                localStorage.setItem("language", e.target.value);
              }}
              title="Select Language"
            >
              <option value="en-US">🇺🇸 EN</option>
              <option value="hi-IN">🇮🇳 HI</option>
              <option value="kn-IN">🇮🇳 KN</option>
              <option value="ta-IN">🇮🇳 TA</option>
            </select>

            {/* Emergency Button - on top right next to profile */}
            <button
              onClick={() => setShowEmergency(true)}
              className="h-[38px] flex-shrink-0 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold text-xs sm:text-sm px-2.5 sm:px-3.5 rounded-full shadow-sm shadow-rose-500/25 active:scale-95 transition flex items-center gap-1.5 border border-rose-400/40"
              title={t.emergencyBtn || "Emergency Guide"}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>🚨</span>
              <span className="hidden sm:inline font-bold">{t.emergencyBtn}</span>
              <span className="sm:hidden font-bold">SOS</span>
            </button>

            {/* Medication (+ Add Med) Button - on top right next to profile */}
            <button
              onClick={() => setShowAddModal(true)}
              className="h-[38px] flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3.5 rounded-full shadow-sm shadow-indigo-600/25 active:scale-95 transition flex items-center gap-1 sm:gap-1.5 border border-indigo-500/30"
              title={t.addMedTitle || "Add Medication"}
            >
              <span className="text-sm sm:text-base font-black leading-none">+</span>
              <span className="hidden sm:inline">{t.addMedTitle}</span>
              <span className="sm:hidden font-bold">Med</span>
            </button>

            {/* Profile Button */}
            <button
              onClick={() => navigate("/profile")}
              className="h-[38px] flex-shrink-0 bg-white hover:bg-slate-50 border border-slate-200/90 px-2.5 sm:px-3.5 rounded-full text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-200 shadow-xs hover:shadow-sm active:scale-95 transition flex items-center gap-1 sm:gap-1.5"
              title="Profile"
            >
              <span>👤</span>
              <span className="hidden md:inline">Profile</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

        {/* Greeting Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden mb-8 rounded-[2rem] bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white px-6 sm:px-8 py-6 shadow-xl shadow-indigo-500/30"
        >
          {/* background orbs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-10 left-20 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div>
              <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-0.5">
                {currentTime.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {getGreeting()}, {userName}! 👋
              </h1>
              <p className="text-white/70 text-sm font-medium mt-1">
                {medications.length > 0
                  ? `You have ${medications.length} active medication${medications.length > 1 ? 's' : ''} scheduled today.`
                  : "No medications scheduled yet. Add your first one below."}
              </p>
            </div>

            {/* Next Dose Pill */}
            {(() => {
              const next = getNextReminder();
              if (!next) return (
                <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 text-center w-full sm:w-auto sm:min-w-[140px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-0.5">Next Dose</p>
                  <p className="text-white font-black text-sm">All done today! 🎉</p>
                </div>
              );
              const hrs = Math.floor(next.minsAway / 60);
              const mins = next.minsAway % 60;
              const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
              return (
                <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 text-center w-full sm:w-auto sm:min-w-[160px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-0.5">Next Dose In</p>
                  <p className="text-white font-black text-xl leading-none">{timeLabel}</p>
                  <p className="text-white/80 text-xs font-semibold mt-1 truncate">{next.name} · {next.time}</p>
                </div>
              );
            })()}
          </div>
        </motion.div>

        {/* Today's Schedule Strip */}
        {medications.length > 0 && (() => {
          const schedule = [];
          medications.forEach(med => {
            if (!med.reminderTime) return;
            String(med.reminderTime).split(",").forEach(timeStr => {
              const t = timeStr.trim();
              if (!t) return;
              const [hh, mm] = t.split(":").map(Number);
              const now = currentTime;
              const isPast = hh < now.getHours() || (hh === now.getHours() && mm <= now.getMinutes());
              const doses = Number(med.dosesPerDay) || 1;
              const takenCount = loggedToday[med._id] || 0;
              const isLogged = takenCount >= doses;
              schedule.push({ name: med.medicineName, time: t, hh, mm, isPast, isLogged, id: med._id + t });
            });
          });
          schedule.sort((a, b) => a.hh * 60 + a.mm - (b.hh * 60 + b.mm));
          if (schedule.length === 0) return null;
          return (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-extrabold text-slate-700 uppercase tracking-widest">⏱ Today's Schedule</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {schedule.map(item => (
                  <div
                    key={item.id}
                    className={`flex-shrink-0 flex flex-col items-center justify-center px-4 py-3 rounded-2xl border-2 min-w-[110px] transition-all duration-300 ${
                      item.isLogged
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-md shadow-emerald-100'
                        : item.isPast
                        ? 'bg-rose-50 border-rose-300 text-rose-600 shadow-md shadow-rose-100'
                        : 'bg-white border-indigo-200 text-indigo-700 shadow-sm'
                    }`}
                  >
                    <span className="text-lg mb-0.5">
                      {item.isLogged ? '✅' : item.isPast ? '⏰' : '💊'}
                    </span>
                    <span className="font-black text-sm text-center leading-tight max-w-[90px] truncate">{item.name}</span>
                    <span className="text-xs font-bold mt-1 opacity-80">{item.time}</span>
                    {item.isLogged && <span className="text-[9px] font-extrabold uppercase tracking-wider mt-1 bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Done</span>}
                    {!item.isLogged && item.isPast && <span className="text-[9px] font-extrabold uppercase tracking-wider mt-1 bg-rose-500 text-white px-1.5 py-0.5 rounded-full">Due</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{t.dashboardTitle1} <span className="text-gradient">{t.dashboardTitle2}</span></h1>
            <p className="text-slate-500 mt-1 font-medium text-sm sm:text-base">{t.dashboardSubtitle}</p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            <button onClick={() => setShowLowStockModal(true)} className="glass bg-orange-100/80 hover:bg-orange-200 text-orange-700 border-2 border-orange-200 px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition shadow-sm flex items-center justify-center gap-1.5 sm:gap-2">
              ⚠️ Low Stock
            </button>
            <button onClick={() => setShowAddModal(true)} className="glass bg-white hover:bg-indigo-50 text-indigo-700 px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition shadow-sm border-2 border-indigo-200 flex items-center justify-center gap-1.5 sm:gap-2">
              <span className="text-base sm:text-lg leading-none font-black">+</span> {t.addMedTitle}
            </button>
            <button onClick={() => navigate("/upload")} className="col-span-2 sm:col-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-md sm:shadow-lg shadow-indigo-600/30 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2">
              📸 {t.uploadBtn}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Stats & Active Meds */}
          <div className="col-span-2 space-y-8">

            {/* Stats Cards - Responsive 2x2 on mobile, 4-col on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl relative overflow-hidden border border-emerald-100/80 shadow-sm sm:shadow-md hover:-translate-y-1 transition duration-300">
                <div className="absolute -right-4 -top-4 w-16 sm:w-20 h-16 sm:h-20 bg-emerald-500/10 rounded-full blur-xl"></div>
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-500 font-bold uppercase text-[10px] sm:text-xs tracking-wider">{t.takenLabel}</h3>
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">✓</span>
                </div>
                <p className="text-2xl sm:text-4xl font-black text-slate-800 mt-2">{stats.taken}</p>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl relative overflow-hidden border border-rose-100/80 shadow-sm sm:shadow-md hover:-translate-y-1 transition duration-300">
                <div className="absolute -right-4 -top-4 w-16 sm:w-20 h-16 sm:h-20 bg-rose-500/10 rounded-full blur-xl"></div>
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-500 font-bold uppercase text-[10px] sm:text-xs tracking-wider">{t.missedLabel}</h3>
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">✕</span>
                </div>
                <p className="text-2xl sm:text-4xl font-black text-slate-800 mt-2">{stats.missed}</p>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="glass p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 border-none shadow-sm sm:shadow-lg shadow-indigo-500/25 hover:-translate-y-1 transition duration-300 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-white/80 font-bold uppercase text-[10px] sm:text-xs tracking-wider">{t.adherenceLabel}</h3>
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-black">%</span>
                </div>
                <p className="text-2xl sm:text-4xl font-black text-white mt-2">{stats.adherence}%</p>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="glass p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl relative overflow-hidden bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 border-none shadow-sm sm:shadow-lg shadow-cyan-500/25 hover:-translate-y-1 transition duration-300 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-white/80 font-bold uppercase text-[10px] sm:text-xs tracking-wider">Glucose</h3>
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-black">🩸</span>
                </div>
                <p className="text-2xl sm:text-4xl font-black text-white mt-2">{glucoseLevel ? glucoseLevel : "--"}</p>
              </motion.div>
            </div>

            {/* Meds List with Outer Border Container */}
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-indigo-50/30 to-slate-50 p-4 sm:p-7 rounded-3xl sm:rounded-[2.5rem] border-2 border-indigo-200/80 shadow-xl shadow-indigo-500/5 backdrop-blur-xl">
              {/* Background ambient lighting glow */}
              <div className="absolute -top-12 -left-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-indigo-100/80 relative z-10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-indigo-400/30 relative">
                    {/* Active Reminder Capsule & Notification Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                      <path d="m8.5 8.5 7 7"/>
                    </svg>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">{t.activeMedsTitle}</h2>
                    <p className="text-xs text-slate-500 font-medium hidden sm:block">Your daily scheduled prescriptions & active reminders</p>
                  </div>
                </div>
                <button onClick={() => setShowEmergency(true)} className="bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200/80 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-sm">
                  <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span></span>
                  {t.emergencyBtn}
                </button>
              </div>

              {/* Medication cards — cleanly separated with distinct cards, margins, and borders */}
              <div className="space-y-4 relative z-10">
                <AnimatePresence>
                  {medications.length === 0 && (
                    <div className="bg-white/80 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                      <span className="text-4xl block mb-2">📋</span>
                      <p className="text-slate-500 font-bold text-lg">{t.emptyMeds}</p>
                    </div>
                  )}
                  {medications.map((med, idx) => {
                    // Distinct accent colors for borders and sequence badges
                    const accents = [
                      { border: 'border-l-indigo-500',  badgeBg: 'bg-indigo-500',  badgeRing: 'ring-indigo-100',  badgeText: 'text-indigo-600',  cardBorder: 'border-indigo-100' },
                      { border: 'border-l-violet-500',  badgeBg: 'bg-violet-500',  badgeRing: 'ring-violet-100',  badgeText: 'text-violet-600',  cardBorder: 'border-violet-100' },
                      { border: 'border-l-teal-500',    badgeBg: 'bg-teal-500',    badgeRing: 'ring-teal-100',    badgeText: 'text-teal-600',    cardBorder: 'border-teal-100' },
                      { border: 'border-l-rose-500',    badgeBg: 'bg-rose-500',    badgeRing: 'ring-rose-100',    badgeText: 'text-rose-600',    cardBorder: 'border-rose-100' },
                      { border: 'border-l-amber-500',   badgeBg: 'bg-amber-500',   badgeRing: 'ring-amber-100',   badgeText: 'text-amber-600',   cardBorder: 'border-amber-100' },
                    ];
                    const accent = accents[idx % accents.length];
                    return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={med._id}
                      className={`group relative bg-white/95 rounded-2xl p-5 sm:p-6 transition-all duration-300 border-2 ${accent.cardBorder} border-l-[6px] ${accent.border} shadow-sm hover:shadow-lg hover:border-slate-300`}
                    >
                      {/* Top separator header with sequence badge and active indicator */}
                      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-full ${accent.badgeBg} text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ${accent.badgeRing}`}>
                            {idx + 1}
                          </span>
                          <span className={`text-xs font-extrabold uppercase tracking-wider ${accent.badgeText}`}>
                            Reminder #{idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Active
                        </div>
                      </div>
                      {editingId === med._id ? (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-800">{t.editMedsTitle}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {renderInput('edit', 'medicineName', 'Name', 'text', 'sm:col-span-2')}
                            {renderInput('edit', 'dosage', 'Dosage')}
                            {renderInput('edit', 'dosesPerDay', 'Freq/Day', 'number')}
                            {renderTimeInputs('edit')}
                            {renderInput('edit', 'totalTablets', 'Stock', 'number', 'sm:col-span-2')}
                          </div>
                          <div className="flex gap-2 pt-3 border-t border-slate-100">
                            <button onClick={handleUpdate} className="flex-1 bg-slate-900 text-white rounded-lg py-2 font-semibold hover:bg-slate-800 transition">{t.saveBtn}</button>
                            <button onClick={() => handleDelete(med._id)} className="flex-1 bg-rose-600 text-white rounded-lg py-2 font-semibold hover:bg-rose-700 transition">Delete</button>
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
                                <span className="text-slate-400 font-normal"> at {med.reminderTime?.split(",").join(", ")}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${med.totalTablets <= med.lowStockThreshold ? 'bg-orange-100 text-orange-700 border-2 border-orange-200' : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200'}`}>
                                {med.totalTablets} {t.leftText}
                              </span>
                            </div>
                          </div>
                          {med.mealTiming && <p className="text-sm font-bold text-amber-600 mb-1">🍽️ {med.mealTiming}</p>}
                          {med.injectionSite && <p className="text-sm font-bold text-blue-600 mb-1">💉 {t.siteText} {med.injectionSite}</p>}
                          <p className="text-sm text-slate-500 mb-5">{med.instructions}</p>
                          <div className="flex gap-2 pt-3 border-t border-slate-100">
                            {(() => {
                               const doses = Number(med.dosesPerDay) || 1;
                               const takenCount = loggedToday[med._id] || 0;
                               const isDone = takenCount >= doses;
                               const btnText = isDone ? 'Logged' : (takenCount > 0 ? `Take (${takenCount}/${doses} done)` : t.takenLabel);
                               const skipText = isDone ? 'Skipped' : (takenCount > 0 ? `Skip (${takenCount}/${doses} done)` : t.skipBtn);
                               
                               return (
                                 <>
                                   <button onClick={() => markTaken(med)} disabled={isDone} className={`flex-1 px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition truncate ${isDone ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'}`}>{btnText}</button>
                                   <button onClick={() => markMissed(med._id, med)} disabled={isDone} className={`flex-1 glass px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition border-slate-200 truncate ${isDone ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'}`}>{skipText}</button>
                                 </>
                               )
                            })()}
                            <button onClick={() => startEdit(med)} className="w-[48px] glass bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center rounded-xl transition border-slate-200 text-xl">⚙️</button>
                          </div>
                        </>
                      )}
                    </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Usage Chart & Weekly Adherence */}
          <div className="space-y-6 w-full flex flex-col items-stretch">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-[2.5rem] shadow-2xl border border-indigo-500/30 backdrop-blur-xl w-full"
            >
              {/* Background ambient lighting effects */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none"></div>

              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl text-indigo-400 shadow-inner">
                    📊
                  </div>
                  <div>
                    <h2 className="font-extrabold text-lg tracking-tight text-white">{t.weeklyAdherenceTitle}</h2>
                    <p className="text-xs text-slate-400 font-medium">Activity trends over time</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Live
                </span>
              </div>

              {/* Quick Stat Summary Pills inside Card */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Adherence</p>
                    <p className="text-lg font-black text-emerald-400">{stats.adherence}%</p>
                  </div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                    💊
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Taken</p>
                    <p className="text-lg font-black text-indigo-300">{stats.taken} doses</p>
                  </div>
                </div>
              </div>

              {/* Chart Component Container */}
              <div className="w-full bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 shadow-inner">
                <UsageChart key={stats.taken + stats.missed} />
              </div>
            </motion.div>
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
                  {renderInput('add', 'dosesPerDay', 'Freq/Day', 'number')}
                  {renderTimeInputs('add')}
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
                  </div>
                </details>

                <div className="flex gap-2 pt-4">
                  <button onClick={handleAdd} className="flex-[2] w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition">
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-dark p-5 sm:p-8 rounded-3xl w-full max-w-md text-center text-white border-rose-500/30 mx-3 sm:mx-0">
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
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass p-5 sm:p-8 rounded-3xl w-full max-w-md text-center shadow-2xl mx-3 sm:mx-0">
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
                <button onClick={() => { if (activeReminder.type === "stock") handleStockUpdate(activeReminder); else markTaken(activeReminder); }} className="flex-[2] w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition">
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
    </div>
  );
}

export default Dashboard;