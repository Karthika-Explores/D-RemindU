import { useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";
import { translations } from "../utils/translations";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const t = translations[language] || translations["en-US"];

  const handleLogin = async () => {
    setErrorMessage("");
    if (!form.email || !form.password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("token", res.data.token);
      window.location.href = "/dashboard";
    } catch (error) {
      let msg = "Error occurred during login.";
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        msg = "Request timed out. The server might be waking up or unavailable. Please try again in a few seconds.";
      } else if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message === "Network Error") {
        msg = "Network Error: Could not reach the server. Please check your connection or verify backend status.";
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 overflow-hidden">
      {/* Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl opacity-70" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/30 rounded-full blur-3xl opacity-70" />
      <div className="absolute top-[20%] right-[20%] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
      
      {/* Language Selector */}
      <div className="absolute top-6 right-6 z-50">
        <select
          className="glass text-sm font-bold text-slate-600 outline-none hover:text-indigo-600 transition cursor-pointer px-4 py-2 rounded-full appearance-none shadow-sm"
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
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass p-10 rounded-[2rem] shadow-2xl w-full max-w-[400px] z-10 mx-4 border border-white/60"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 rounded-3xl shadow-xl shadow-indigo-500/30 mb-4 p-2.5 border border-white/50 relative">
            <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
              <g transform="translate(52, 46) rotate(-35)">
                <path d="M -16, -26 A 16,16 0 0,1 16, -26 L 16, 0 L -16, 0 Z" fill="#FFFFFF" />
                <path d="M -16, 0 L 16, 0 L 16, 26 A 16,16 0 0,1 -16, 26 Z" fill="#10B981" />
                <line x1="-16" y1="0" x2="16" y2="0" stroke="#0F172A" strokeWidth="2.5" opacity="0.2" />
              </g>
              <g transform="translate(68, 66)">
                <circle cx="12" cy="12" r="16" fill="#F59E0B" />
                <path d="M 12,4 C 8.6,4 6,6.6 6,10 L 6,14 L 4,16 L 4,17 L 20,17 L 20,16 L 18,14 L 18,10 C 18,6.6 15.4,4 12,4 Z M 10,18 C 10,19.1 10.9,20 12,20 C 13.1,20 14,19.1 14,18 Z" fill="#FFFFFF" />
              </g>
            </svg>
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-1">D-RemindU</h2>
          <p className="text-slate-500 font-semibold text-xs tracking-wider uppercase">💊 Smart Medication & Health Companion</p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t.emailLabel}</label>
            <input
              type="email"
              placeholder=""
              className="w-full bg-white/60 border border-slate-200/60 p-3.5 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t.passwordLabel}</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-white/60 border border-slate-200/60 p-3.5 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className={`w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-0.5 mt-2 flex items-center justify-center ${
              loading ? "opacity-75 cursor-not-allowed" : "hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/30"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </span>
            ) : (
              t.signInBtn
            )}
          </button>
        </div>

        <p className="text-center mt-8 text-sm font-semibold text-slate-500">
          {t.noAccountText}
          <span 
            className="text-indigo-600 hover:text-indigo-800 cursor-pointer transition"
            onClick={() => (window.location.href = "/register")}
          >
            {t.createOneText}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;