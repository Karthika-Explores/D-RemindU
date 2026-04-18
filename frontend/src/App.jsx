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
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(reg => {
        console.log("Service Worker registered successfully", reg.scope);
      }).catch(err => console.error("SW Registration failed:", err));
    }

    // Check if we need to ask for permissions explicitly
    if ("Notification" in window && Notification.permission === "default") {
      setShowPermissionModal(true);
    }
  }, []);

  const requestPermissions = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative border-t-8 border-indigo-500">
            <div className="w-16 h-16 bg-indigo-100 flex items-center justify-center rounded-full mx-auto mb-4 text-3xl">
              🔔
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Enable Notifications</h2>
            <p className="text-slate-500 font-medium text-sm mb-6">
              To send you medication alerts even when the browser is closed, we need you to grant notification permissions right now at the beginning.
            </p>
            <button 
              onClick={requestPermissions}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition"
            >
              Allow Notifications
            </button>
            <button 
              onClick={() => setShowPermissionModal(false)}
              className="w-full mt-3 text-slate-500 font-bold hover:text-slate-700 transition"
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