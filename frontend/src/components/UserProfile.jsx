import { useEffect, useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import DRemindULogo from "./DRemindULogo";
import { unsubscribePush } from "../services/pushService";

function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await API.get("/user/profile");
      setUser(res.data);
      setFormData(res.data);

      const lsUserStr = localStorage.getItem("user");
      if (lsUserStr) {
        try {
          const lsUser = JSON.parse(lsUserStr);
          localStorage.setItem("user", JSON.stringify({ ...lsUser, ...res.data }));
        } catch (err) {
          console.warn("Could not sync cached user:", err);
        }
      }
    } catch (error) {
      console.error("Profile fetch error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Remove this browser's push subscription from MongoDB first
    // so it stops receiving notifications after logout
    await unsubscribePush();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleSave = async () => {
    try {
      const res = await API.put("/user/profile", {
        name: formData.name,
        age: formData.age,
        weight: formData.weight,
        glucoseLevel: formData.glucoseLevel,
        emergencyContact: formData.emergencyContact,
        stockReminderTime: formData.stockReminderTime
      });
      setUser(res.data);
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      const lsUserStr = localStorage.getItem("user");
      if (lsUserStr) {
        try {
          const lsUser = JSON.parse(lsUserStr);
          localStorage.setItem("user", JSON.stringify({ ...lsUser, ...res.data }));
        } catch (err) {
          console.warn("Could not sync cached user:", err);
        }
      }
    } catch (error) {
      console.error("Profile update error:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2.5">
          <svg className="w-8 h-8 text-yellow-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-400 font-medium text-xs">Loading patient records...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Unable to Load Profile</h2>
        <p className="text-xs text-slate-500 mb-5 max-w-xs">We could not retrieve your patient record. Please check your network or sign in again.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded-lg transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 pb-12">
      {/* Top Header */}
      <header className="bg-[#090d16]/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition py-1.5 px-2.5 rounded-lg hover:bg-slate-800"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </button>

          <DRemindULogo size="sm" onClick={() => navigate("/dashboard")} className="cursor-pointer" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 py-1.5 px-3 rounded-lg border border-red-900/50 transition"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {saveSuccess && (
          <div className="mb-5 bg-emerald-950/40 border border-emerald-800/70 text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Profile updated successfully.</span>
          </div>
        )}

        {/* Patient Identity Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 sm:p-7 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 flex items-center justify-center text-2xl font-bold shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : "P"}
              </div>
              <div className="min-w-0">
                {editing ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Name</label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-white tracking-tight">{user.name || "Patient Record"}</h1>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{user.email || "No email recorded"}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer shadow-md shadow-yellow-400/20"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setFormData(user);
                      setEditing(false);
                    }}
                    className="bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-yellow-400/20"
                >
                  <svg className="w-3.5 h-3.5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>

          {/* Vitals Summary Grid */}
          <div className="pt-6">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Health Metrics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Age */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Age</span>
                {editing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.age || ""}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-16 h-8 px-2 bg-slate-900 border border-slate-700 rounded text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                    />
                    <span className="text-xs text-slate-400">years</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-white">{user.age ? `${user.age} yrs` : "—"}</p>
                )}
              </div>

              {/* Weight */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Body Weight</span>
                {editing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.weight || ""}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="w-16 h-8 px-2 bg-slate-900 border border-slate-700 rounded text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                    />
                    <span className="text-xs text-slate-400">kg</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-white">{user.weight ? `${user.weight} kg` : "—"}</p>
                )}
              </div>

              {/* Fasting Glucose */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Fasting Glucose</span>
                {editing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={formData.glucoseLevel || ""}
                      onChange={(e) => setFormData({ ...formData, glucoseLevel: e.target.value })}
                      className="w-20 h-8 px-2 bg-slate-900 border border-slate-700 rounded text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                    />
                    <span className="text-xs text-slate-400">mg/dL</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-white">{user.glucoseLevel ? `${user.glucoseLevel} mg/dL` : "—"}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Emergency & Notifications Settings Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 sm:p-7 mb-6">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Emergency & Notification Config</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Emergency Contact */}
            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-xs font-semibold text-slate-300">Designated Emergency Caregiver</span>
              </div>
              {editing ? (
                <div>
                  <input
                    type="tel"
                    value={formData.emergencyContact || ""}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:outline-none focus:border-yellow-400"
                    placeholder="+1 234 567 8900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Directly contacted during severe medical events or when SOS is triggered.</p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-bold text-white">{user.emergencyContact || "No contact registered"}</p>
                  {user.emergencyContact && (
                    <a
                      href={`tel:${user.emergencyContact}`}
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-yellow-400 hover:underline"
                    >
                      <span>Call caregiver</span>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Daily Inventory Alert Time */}
            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-semibold text-slate-300">Prescription Stock Alert Schedule</span>
              </div>
              {editing ? (
                <div>
                  <input
                    type="time"
                    value={formData.stockReminderTime || ""}
                    onChange={(e) => setFormData({ ...formData, stockReminderTime: e.target.value })}
                    className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:outline-none focus:border-yellow-400"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Server checks pill counts and alerts you if refilling is required.</p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-bold text-white">{user.stockReminderTime || "Default (09:00 AM)"}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automated low-stock background checks are active.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clinical Note Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-xs text-slate-400 leading-relaxed">
            Patient health metrics are kept locally encrypted and referenced only to calculate dose intervals and hypoglycemia safety warnings. Always confirm changes with your supervising physician.
          </p>
        </div>
      </main>
    </div>
  );
}

export default UserProfile;