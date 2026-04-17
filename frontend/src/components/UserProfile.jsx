import { useEffect, useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
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
        } catch(e) {}
      }
    } catch (error) {
      console.error("Profile fetch error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
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
      
      const lsUserStr = localStorage.getItem("user");
      if (lsUserStr) {
        try {
          const lsUser = JSON.parse(lsUserStr);
          localStorage.setItem("user", JSON.stringify({ ...lsUser, ...res.data }));
        } catch(e) {}
      }
    } catch (error) {
      console.error("Profile update error:", error);
      alert("Failed to update profile");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-xl font-bold text-slate-800 mb-4">Error loading profile</p>
        <button onClick={() => navigate("/dashboard")} className="bg-indigo-600 text-white px-6 py-2 rounded-xl">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>

      <div className="max-w-2xl mx-auto relative z-10">
        <button onClick={() => navigate("/dashboard")} className="mb-8 flex items-center text-slate-600 hover:text-indigo-600 font-bold transition">
          ← Back to Dashboard
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-8 md:p-12 rounded-3xl relative">
          
          <div className="absolute top-8 right-8">
            {editing ? (
              <button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-5 rounded-full shadow-lg transition">
                Save Profile
              </button>
            ) : (
              <button onClick={() => setEditing(true)} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2 px-5 rounded-full transition flex items-center gap-2">
                <span>✏️</span> Edit
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 border-b border-slate-200/50 pb-8 mb-8">
            <div className="w-32 h-32 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-full flex items-center justify-center text-white text-5xl font-black shadow-xl shadow-indigo-500/30 shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="text-center md:text-left w-full pr-8">
              {editing ? (
                <div className="mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
                  <input type="text" value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full text-2xl font-extrabold text-slate-800 bg-white/50 border-2 border-indigo-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              ) : (
                <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">{user.name || "Unknown User"}</h1>
              )}
              
              <p className="text-lg text-slate-500 font-medium pt-1">{user.email || "No email provided"}</p>
              
              {editing ? (
                <div className="flex flex-col sm:flex-row gap-4 mt-4 mb-2 max-w-lg">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><span>🚑</span> Emergency Contact</label>
                    <input type="text" value={formData.emergencyContact || ""} onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})} className="w-full text-lg font-bold text-rose-700 bg-white/50 border-2 border-rose-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-500 outline-none mt-1" placeholder="e.g. +1 234 567 8900" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><span>⏰</span> Stock Alert Time</label>
                    <input type="time" value={formData.stockReminderTime || ""} onChange={(e) => setFormData({...formData, stockReminderTime: e.target.value})} className="w-full text-lg font-bold text-indigo-700 bg-white/50 border-2 border-indigo-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none mt-1" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl border border-rose-100 shadow-sm">
                    <span className="text-lg">🚑</span>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-wider text-rose-400 mb-0.5">Emergency Contact</p>
                      <p className="font-bold leading-none">{user.emergencyContact || "No contact set"}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl border border-indigo-100 shadow-sm">
                    <span className="text-lg">⏰</span>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-wider text-indigo-400 mb-0.5">Stock Alerts</p>
                      <p className="font-bold leading-none">{user.stockReminderTime || "Default (3x a day)"}</p>
                    </div>
                  </div>
                </div>
              )}

              {!editing && (
                <button onClick={handleLogout} className="mt-6 block bg-rose-100 hover:bg-rose-200 text-rose-600 font-bold py-2 px-6 rounded-full transition text-sm">
                  Log Out
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">Health Metrics</h2>
            {editing && <span className="text-xs font-bold text-indigo-500 uppercase">Edit Mode Active</span>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <motion.div className="bg-white/60 p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl mb-3">🎂</div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Age</p>
              {editing ? (
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="150" value={formData.age || ""} onChange={(e) => {
                    const val = e.target.value;
                    if (Number(val) > 150) return;
                    setFormData({...formData, age: val});
                  }} className="w-20 text-center text-2xl font-black text-slate-700 bg-white border-2 border-indigo-200 rounded-lg p-1 outline-none" />
                  <span className="text-slate-500 font-bold">yrs</span>
                </div>
              ) : (
                <p className="text-3xl font-black text-slate-700">{user.age ? `${user.age} yrs` : "--"}</p>
              )}
            </motion.div>

            <motion.div className="bg-white/60 p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl mb-3">⚖️</div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Weight</p>
              {editing ? (
                 <div className="flex items-center gap-1">
                  <input type="number" step="0.1" value={formData.weight || ""} onChange={(e) => setFormData({...formData, weight: e.target.value})} className="w-20 text-center text-2xl font-black text-slate-700 bg-white border-2 border-indigo-200 rounded-lg p-1 outline-none" />
                  <span className="text-slate-500 font-bold">kg</span>
                 </div>
              ) : (
                <p className="text-3xl font-black text-slate-700">{user.weight ? `${user.weight} kg` : "--"}</p>
              )}
            </motion.div>

            <motion.div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-indigo-500/20 flex flex-col items-center relative overflow-hidden">
              <div className="w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center text-xl mb-3">🩸</div>
              <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1 text-center">Fasting Glucose</p>
              {editing ? (
                  <input type="number" value={formData.glucoseLevel || ""} onChange={(e) => setFormData({...formData, glucoseLevel: e.target.value})} className="w-24 text-center text-2xl font-black text-indigo-900 bg-white border-2 border-transparent focus:border-indigo-300 rounded-lg p-1 outline-none relative z-10" />
              ) : (
                <p className="text-3xl font-black text-white relative z-10">{user.glucoseLevel ? `${user.glucoseLevel}` : "--"}</p>
              )}
              {/* Optional decor inside the blue card */}
              <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-md"></div>
            </motion.div>

          </div>

          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><span>💡</span> Health Tip</h3>
            <p className="text-amber-700 text-sm">Always take your medication exactly as prescribed. Based on your glucose levels, regular checkups with an endocrinologist are highly recommended.</p>
          </div>

        </motion.div>
      </div>
    </div>
  );
}

export default UserProfile;