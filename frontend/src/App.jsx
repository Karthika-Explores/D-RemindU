import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import UserProfile from "./components/UserProfile";
import UploadPrescription from "./components/UploadPrescription";

const PrivateRoute = ({ children }) => {
  return localStorage.getItem("token") ? children : <Navigate to="/login" />;
};

function App() {
  const [showPermissionModal, setShowPermissionModal] = useState(() => {
    if (typeof window !== "undefined" && window.Notification) {
      return window.Notification.permission === "default";
    }
    return false;
  });

  useEffect(() => {
    // Register Service Worker
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      navigator.serviceWorker.register("/sw.js").then(reg => {
        console.log("Service Worker registered successfully", reg.scope);
      }).catch(err => console.error("SW Registration failed:", err));
    }
  }, []);

  const requestPermissions = async () => {
    if (typeof window !== "undefined" && window.Notification) {
      const permission = await window.Notification.requestPermission();
      if (permission === 'granted') {
        setShowPermissionModal(false);
      } else {
        // Even if denied, we shouldn't block the app indefinitely
        setShowPermissionModal(false); 
      }
    }
  };

  return (
    <>
      {showPermissionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 p-7 rounded-2xl max-w-sm w-full text-center shadow-2xl relative">
            <div className="w-14 h-14 bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center rounded-2xl mx-auto mb-4 text-yellow-400 shadow-md">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Enable Medication Alerts</h2>
            <p className="text-slate-400 font-medium text-xs leading-relaxed mb-6">
              To deliver punctual dosage reminders even when the browser tab is idle, DRemindU requires push notification permissions.
            </p>
            <button 
              onClick={requestPermissions}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold py-3 rounded-xl shadow-md shadow-yellow-400/20 transition-all text-sm"
            >
              Allow Notifications
            </button>
            <button 
              onClick={() => setShowPermissionModal(false)}
              className="w-full mt-3 text-slate-400 hover:text-slate-200 text-xs font-semibold transition"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute><UploadPrescription /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;