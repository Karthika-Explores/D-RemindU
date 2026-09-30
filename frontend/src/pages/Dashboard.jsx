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
import DRemindULogo from "../components/DRemindULogo";

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
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</label>
        <input
          type={type}
          value={val}
          onChange={onChange}
          className="border border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-lg p-2.5 outline-none transition w-full text-sm"
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
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Reminder Times ({doses} Doses)</label>
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
               className="border border-slate-700 bg-slate-950 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-lg p-2 outline-none transition w-full text-sm"
               required
             />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100">
      <div className="relative z-10">
      {/* Top Navigation Bar with Emergency, Medication, Profile, and Language */}
      <header className="sticky top-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800 shadow-2xs mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <DRemindULogo size="md" textClassName="hidden sm:flex" />
          </div>

          {/* Right: Emergency Button, Medication Button, Profile Button, Language Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-nowrap flex-shrink-0">
            {/* Language Selector */}
            <select
              className="h-[36px] sm:h-[38px] bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 px-2 sm:px-2.5 outline-none transition cursor-pointer flex-shrink-0 shadow-2xs"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                localStorage.setItem("language", e.target.value);
              }}
              title="Select Language"
            >
              <option value="en-US">EN</option>
              <option value="hi-IN">HI</option>
              <option value="kn-IN">KN</option>
              <option value="ta-IN">TA</option>
            </select>

            {/* Emergency Button - on top right next to profile */}
            <button
              onClick={() => setShowEmergency(true)}
              className="h-[36px] sm:h-[38px] flex-shrink-0 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm px-2.5 sm:px-3 rounded-lg shadow-2xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              title={t.emergencyBtn || "Emergency Guide"}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="hidden sm:inline">{t.emergencyBtn}</span>
              <span className="sm:hidden">SOS</span>
            </button>

            {/* Medication (+ Add Med) Button - on top right next to profile */}
            <button
              onClick={() => setShowAddModal(true)}
              className="h-[36px] sm:h-[38px] flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs sm:text-sm px-2.5 sm:px-3 rounded-lg shadow-md shadow-yellow-400/20 active:scale-95 transition flex items-center gap-1 sm:gap-1.5 cursor-pointer"
              title={t.addMedTitle || "Add Medication"}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">{t.addMedTitle}</span>
              <span className="sm:hidden">Med</span>
            </button>

            {/* Profile Button */}
            <button
              onClick={() => navigate("/profile")}
              className="h-[36px] sm:h-[38px] flex-shrink-0 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-2.5 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold text-slate-200 hover:text-white shadow-2xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              title="Profile"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="hidden md:inline">Profile</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

        {/* Greeting Banner */}
        <div className="mb-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-white p-5 sm:p-7 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
                {currentTime.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {getGreeting()}, {userName}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
                {medications.length > 0
                  ? `You have ${medications.length} active prescription${medications.length > 1 ? 's' : ''} scheduled for today.`
                  : "No medications currently scheduled. Add your first prescription below."}
              </p>
            </div>

            {/* Next Dose Pill */}
            {(() => {
              const next = getNextReminder();
              if (!next) return (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center w-full sm:w-auto sm:min-w-[140px]">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Next Dose</p>
                  <p className="text-white font-bold text-xs sm:text-sm">All done today</p>
                </div>
              );
              const hrs = Math.floor(next.minsAway / 60);
              const mins = next.minsAway % 60;
              const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
              return (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center w-full sm:w-auto sm:min-w-[150px]">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Next Dose in</p>
                  <p className="text-yellow-400 font-bold text-lg leading-none">{timeLabel}</p>
                  <p className="text-slate-300 text-xs mt-1 truncate">{next.name} · {next.time}</p>
                </div>
              );
            })()}
          </div>
        </div>

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
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Today's Schedule</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                {schedule.map(item => (
                  <div
                    key={item.id}
                    className={`flex-shrink-0 flex flex-col items-center justify-center px-3.5 py-2.5 rounded-xl border min-w-[105px] transition-all ${
                      item.isLogged
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : item.isPast
                        ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="mb-1">
                      {item.isLogged ? (
                        <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : item.isPast ? (
                        <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                        </svg>
                      )}
                    </div>
                    <span className="font-semibold text-xs text-center leading-tight max-w-[95px] truncate text-white">{item.name}</span>
                    <span className="text-[11px] font-medium text-slate-400 mt-0.5">{item.time}</span>
                    {item.isLogged && <span className="text-[9px] font-bold uppercase tracking-wider mt-1 bg-emerald-600 text-white px-1.5 py-0.2 rounded">Taken</span>}
                    {!item.isLogged && item.isPast && <span className="text-[9px] font-bold uppercase tracking-wider mt-1 bg-rose-600 text-white px-1.5 py-0.2 rounded">Due</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">{t.dashboardTitle1} <span className="text-yellow-400">{t.dashboardTitle2}</span></h1>
            <p className="text-slate-400 mt-1 font-medium text-sm sm:text-base">{t.dashboardSubtitle}</p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
            <button onClick={() => setShowLowStockModal(true)} className="bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
              <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Low Stock</span>
            </button>
            <button onClick={() => setShowAddModal(true)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 border border-yellow-400 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-yellow-400/20">
              <svg className="w-3.5 h-3.5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t.addMedTitle}</span>
            </button>
            <button onClick={() => navigate("/upload")} className="col-span-2 sm:col-auto bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{t.uploadBtn}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

          {/* LEFT COLUMN: Stats & Active Meds */}
          <div className="col-span-2 space-y-6 sm:space-y-8">

            {/* Stats Cards - Responsive 2x2 on mobile, 4-col on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3.5">
              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">{t.takenLabel}</span>
                  <span className="w-5 h-5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 flex items-center justify-center text-xs font-bold">✓</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-2">{stats.taken}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Doses taken today</p>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">{t.missedLabel}</span>
                  <span className="w-5 h-5 rounded-md bg-rose-950/60 text-rose-400 border border-rose-800/80 flex items-center justify-center text-xs font-bold">✕</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-2">{stats.missed}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Missed or skipped</p>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">{t.adherenceLabel}</span>
                  <span className="w-5 h-5 rounded-md bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center text-xs font-bold">%</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-400 mt-2">{stats.adherence}%</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Overall compliance</p>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Glucose</span>
                  <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center text-[10px] font-bold">mg</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-2">{glucoseLevel ? glucoseLevel : "--"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Fasting baseline</p>
              </div>
            </div>

            {/* Meds List Container */}
            <div className="bg-slate-900/90 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl">

              <div className="flex flex-wrap justify-between items-center mb-5 pb-3 border-b border-slate-800 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                      <path d="m8.5 8.5 7 7"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{t.activeMedsTitle}</h2>
                    <p className="text-xs text-slate-400">Your daily scheduled prescriptions & active reminders</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                  {medications.length} {medications.length === 1 ? 'Medication' : 'Medications'}
                </span>
              </div>

              {/* Medication cards */}
              <div className="space-y-3.5">
                <AnimatePresence>
                  {medications.length === 0 && (
                    <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 text-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                          <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                        </svg>
                      </div>
                      <p className="text-slate-300 font-semibold text-sm">{t.emptyMeds}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Use the "+ Add Medication" button above to log your prescriptions.</p>
                    </div>
                  )}
                  {medications.map((med, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={med._id}
                      className="bg-slate-950/70 rounded-xl p-4 sm:p-5 border border-slate-800 shadow-sm hover:border-slate-700 transition"
                    >
                      {/* Top row with sequence badge & active indicator */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-yellow-400/10 text-yellow-400 text-xs font-bold flex items-center justify-center shrink-0 border border-yellow-400/30">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-300">
                            Prescription #{idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Active</span>
                        </div>
                      </div>
                      {editingId === med._id ? (
                        <div className="space-y-3.5">
                          <h4 className="font-bold text-sm text-white">{t.editMedsTitle}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {renderInput('edit', 'medicineName', 'Name', 'text', 'sm:col-span-2')}
                            {renderInput('edit', 'dosage', 'Dosage')}
                            {renderInput('edit', 'dosesPerDay', 'Freq/Day', 'number')}
                            {renderTimeInputs('edit')}
                            {renderInput('edit', 'totalTablets', 'Stock', 'number', 'sm:col-span-2')}
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-slate-800">
                            <button onClick={handleUpdate} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-lg py-2 text-xs font-bold transition cursor-pointer shadow-md shadow-yellow-400/20">{t.saveBtn}</button>
                            <button onClick={() => handleDelete(med._id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-xs font-semibold transition cursor-pointer">Delete</button>
                            <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-xs font-semibold transition cursor-pointer border border-slate-700">{t.cancelBtn}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-base sm:text-lg text-white">{med.medicineName}</h3>
                              <p className="text-xs sm:text-sm font-medium text-slate-300">
                                {med.dosage}{/^\d+(\.\d+)?$/.test(String(med.dosage).trim()) ? ' mg' : ''}
                                {med.tabletsPerDose ? ` (${med.tabletsPerDose} ${med.tabletsPerDose == 1 ? 'tablet' : 'tablets'})` : ''}
                                <span className="text-slate-400 font-normal"> · Scheduled at {med.reminderTime?.split(",").join(", ")}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${med.totalTablets <= med.lowStockThreshold ? 'bg-amber-950/60 text-amber-300 border-amber-800' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                                {med.totalTablets} {t.leftText}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center mt-2 mb-2">
                            {med.mealTiming && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/80 px-2.5 py-0.5 rounded-md mr-2">
                                <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                <span>{med.mealTiming}</span>
                              </span>
                            )}
                            {med.injectionSite && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-blue-950/40 border border-blue-800/80 px-2.5 py-0.5 rounded-md">
                                <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.7H3v-4.1c.1-.6.3-1.2.7-1.6L15 4"/><path d="m9 11 4 4"/></svg>
                                <span>{t.siteText} {med.injectionSite}</span>
                              </span>
                            )}
                          </div>
                          {med.instructions && <p className="text-xs text-slate-400 mb-4">{med.instructions}</p>}
                          <div className="flex gap-2 pt-3 border-t border-slate-800">
                            {(() => {
                               const doses = Number(med.dosesPerDay) || 1;
                               const takenCount = loggedToday[med._id] || 0;
                               const isDone = takenCount >= doses;
                               const btnText = isDone ? 'Logged' : (takenCount > 0 ? `Take (${takenCount}/${doses})` : t.takenLabel);
                               const skipText = isDone ? 'Skipped' : (takenCount > 0 ? `Skip (${takenCount}/${doses})` : t.skipBtn);
                               
                               return (
                                 <>
                                   <button onClick={() => markTaken(med)} disabled={isDone} className={`flex-1 h-9 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${isDone ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'}`}>
                                     {!isDone && <span className="font-bold">✓</span>}
                                     <span>{btnText}</span>
                                   </button>
                                   <button onClick={() => markMissed(med._id, med)} disabled={isDone} className={`flex-1 h-9 px-3 rounded-lg text-xs font-semibold transition border cursor-pointer flex items-center justify-center gap-1.5 ${isDone ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' : 'bg-slate-950 hover:bg-rose-950/60 text-rose-400 border-rose-800/80 shadow-2xs'}`}>
                                     <span>{skipText}</span>
                                   </button>
                                 </>
                               )
                            })()}
                            <button onClick={() => startEdit(med)} className="w-9 h-9 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center rounded-lg transition border border-slate-700 cursor-pointer shadow-2xs shrink-0" title="Edit Prescription">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Usage Chart & Weekly Adherence */}
          <div className="space-y-6 w-full flex flex-col items-stretch">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-white">{t.weeklyAdherenceTitle}</h2>
                    <p className="text-[11px] text-slate-400">7-day prescription compliance trends</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                  Last 7 Days
                </span>
              </div>

              {/* Chart Component Container */}
              <div className="w-full">
                <UsageChart key={stats.taken + stats.missed} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Medication Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }} className="bg-slate-900 border border-slate-800 text-white p-6 sm:p-7 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-left shadow-2xl relative">
              {/* Close Button */}
              <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white transition bg-slate-800 hover:bg-slate-700 rounded-lg w-8 h-8 flex items-center justify-center text-sm font-semibold cursor-pointer">
                ✕
              </button>

              <div className="mb-5 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-xl text-white">
                    {extractedQueue.length > 0 ? t.reviewScanned : t.addMedTitle}
                  </h2>
                </div>
                {extractedQueue.length > 0 && (
                  <span className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-md mt-1 inline-block">
                    Item {queueIndex + 1} of {extractedQueue.length}
                  </span>
                )}
                <p className="text-xs text-slate-400 mt-1">Fill in the prescription details and scheduling parameters below.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderInput('add', 'medicineName', 'Medicine Name', 'text', 'md:col-span-2')}
                  {renderInput('add', 'dosage', 'Dosage (e.g. 500mg)')}
                  {renderInput('add', 'dosesPerDay', 'Doses Per Day', 'number')}
                  {renderTimeInputs('add')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  {renderInput('add', 'totalTablets', 'Current Stock (Pills)', 'number')}
                  {renderInput('add', 'lowStockThreshold', 'Low Stock Alert Threshold', 'number')}
                  <div className="md:col-span-2 flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Meal Timing Instruction</label>
                    <select value={form.mealTiming || ""} onChange={(e) => setForm({ ...form, mealTiming: e.target.value })} className="border border-slate-700 bg-slate-950 text-white text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-lg p-2.5 outline-none transition">
                      <option value="">No specific timing</option>
                      <option>Fasting (Empty Stomach)</option>
                      <option>Before Food</option>
                      <option>With Food</option>
                      <option>After Food</option>
                    </select>
                  </div>
                </div>

                {/* Optional Overrides */}
                <details className="text-xs text-slate-400 group cursor-pointer outline-none pt-1">
                  <summary className="font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5 py-1">
                    <span>{t.advancedDetails}</span>
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex flex-col space-y-1 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-300">Injection Site (if applicable)</label>
                      <select value={form.injectionSite} onChange={(e) => setForm({ ...form, injectionSite: e.target.value })} className="border border-slate-700 bg-slate-900 text-white text-xs focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-lg p-2 outline-none transition">
                        <option value="">None / Oral Tablet</option>
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

                <div className="flex gap-2.5 pt-3 border-t border-slate-800">
                  <button onClick={handleAdd} className="flex-[2] bg-yellow-400 hover:bg-yellow-300 text-slate-950 h-10 px-4 rounded-xl text-sm font-bold transition cursor-pointer shadow-md shadow-yellow-400/20 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{extractedQueue.length > 0 ? t.saveNextBtn : t.saveMedBtn}</span>
                  </button>
                  {extractedQueue.length > 0 && (
                    <button onClick={handleNextInQueue} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 h-10 px-4 rounded-xl text-sm font-semibold transition cursor-pointer">
                      {t.skipBtn}
                    </button>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }} className="bg-slate-900 border border-rose-500/30 p-6 sm:p-7 rounded-2xl w-full max-w-md text-left text-white shadow-2xl mx-3 sm:mx-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/30 shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{t.hypoTitle}</h2>
                  <p className="text-xs text-rose-300 font-medium">Standard Clinical Protocol: 15-15 Rule</p>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 mb-5">
                <p className="font-semibold text-xs text-rose-300 mb-2.5 pb-2 border-b border-slate-700">{t.hypoRule}</p>
                <ul className="text-xs space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>{t.hypoStep1}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>{t.hypoStep2}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span>{t.hypoStep3}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <span>{t.hypoStep4}</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <a href={`tel:${emergencyContact}`} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold h-11 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>{t.callEmergency}: {emergencyContact}</span>
                </a>
                <button onClick={() => setShowEmergency(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold h-10 rounded-xl text-xs transition cursor-pointer">
                  {t.dismissBtn}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder Modal */}
      <AnimatePresence>
        {activeReminder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }} className="bg-slate-900 border border-slate-800 text-white p-6 sm:p-7 rounded-2xl w-full max-w-md text-center shadow-2xl mx-3 sm:mx-0">
              <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4 ${activeReminder.type === 'time' ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-500/30' : 'bg-amber-950/60 text-amber-300 border border-amber-800'}`}>
                {activeReminder.type === "time" ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
              </div>
              <h2 className="text-xl font-bold mb-1.5 text-white">
                {activeReminder.type === "time" ? t.medTimeAlert : t.stockAlertTitle}
              </h2>
              <p className="text-slate-300 text-sm mb-5">
                {activeReminder.type === "time" ? `${t.medTimeMsg} ${activeReminder.medicineName}.` : `${t.stockAlertMsg} ${activeReminder.medicineName}.`}
              </p>

              {activeReminder.type === "stock" && (
                <div className="mb-5 text-left bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">{t.refillAmount}</label>
                  <input type="number" value={takenQty} min="1" onChange={(e) => setTakenQty(Number(e.target.value))} className="w-full text-center text-xl font-bold border border-slate-700 bg-slate-900 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 rounded-lg p-2 outline-none" />
                </div>
              )}

              <div className="flex gap-2.5">
                <button onClick={() => { if (activeReminder.type === "stock") handleStockUpdate(activeReminder); else markTaken(activeReminder); }} className="flex-[2] bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold h-10 px-4 rounded-xl text-sm transition cursor-pointer shadow-md shadow-yellow-400/20">
                  {t.confirmBtn}
                </button>
                <button onClick={handleLaterPopup} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold h-10 px-4 rounded-xl text-sm transition cursor-pointer border border-slate-700">
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
          <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div initial={{scale: 0.95, y: 15}} animate={{scale: 1, y: 0}} exit={{scale: 0.95, y: 15}} className="bg-slate-900 border border-slate-800 text-white p-6 sm:p-7 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-left shadow-2xl relative">
              <button onClick={() => setShowLowStockModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white transition bg-slate-800 hover:bg-slate-700 rounded-lg w-8 h-8 flex items-center justify-center text-sm font-semibold cursor-pointer">
                ✕
              </button>

              <div className="mb-5 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-amber-950/60 text-amber-300 rounded-lg flex items-center justify-center border border-amber-800/80">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-xl text-white">Low Stock Inventory Alerts</h2>
                </div>
                <p className="text-xs text-slate-400">The following medications have depleted past their minimum safe threshold.</p>
              </div>

              <div className="space-y-3">
                {medications.filter(m => Number(m.totalTablets) <= Number(m.lowStockThreshold)).length === 0 ? (
                  <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-emerald-300 text-sm">All Inventory In Stock</h3>
                    <p className="text-emerald-400 text-xs mt-0.5">All active prescriptions meet or exceed required minimum reserves.</p>
                  </div>
                ) : (
                  medications.filter(m => Number(m.totalTablets) <= Number(m.lowStockThreshold)).sort((a, b) => Number(a.totalTablets) - Number(b.totalTablets)).map(med => (
                    <div key={med._id} className="border border-amber-800/80 bg-amber-950/30 rounded-xl p-4 flex justify-between items-center sm:flex-row flex-col sm:items-center gap-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">{med.medicineName}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Dosage: <span className="font-medium text-slate-200">{med.dosage}</span> • Alert at: <span className="font-medium text-slate-200">{med.lowStockThreshold} pills</span></p>
                      </div>
                      <div className="bg-slate-950 px-3.5 py-1.5 rounded-lg border border-amber-800/80 sm:w-auto w-full text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Current Stock</p>
                        <p className="text-base font-bold text-rose-600">{med.totalTablets} <span className="text-xs font-normal text-slate-500">tablets left</span></p>
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