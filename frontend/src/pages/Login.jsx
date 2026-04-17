import { useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";
import { translations } from "../utils/translations";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");

  const t = translations[language] || translations["en-US"];

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("token", res.data.token);
      window.location.href = "/dashboard";
    } catch (error) {
      alert(error.response?.data?.message || "Error");
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
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{t.loginTitle}</h2>
          <p className="text-slate-500 font-medium">{t.loginSubtitle}</p>
        </div>

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
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 mt-2"
          >
            {t.signInBtn}
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