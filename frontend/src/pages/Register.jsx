import { useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";
import { translations } from "../utils/translations";

function Register() {
  const [form, setForm] = useState({});
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");

  const t = translations[language] || translations["en-US"];

  const handleRegister = async () => {
    try {
      if(!form.name || !form.email || !form.password || !form.age || !form.emergencyContact) {
          alert("Please fill mandatory fields: name, email, password, age, emergency contact");
          return;
      }
      await API.post("/auth/register", form);
      alert("Registered successfully");
      window.location.href = "/login";
    } catch (error) {
      alert(error.response?.data?.message || "Error");
    }
  };

  const fields = [
    { name: "name", label: t.nameLabel, type: "text", placeholder: "" },
    { name: "email", label: t.emailLabel, type: "email", placeholder: "" },
    { name: "password", label: t.passwordLabel, type: "password", placeholder: "••••••••" },
    { name: "age", label: t.ageLabel, type: "number", placeholder: "" },
    { name: "weight", label: t.weightLabel, type: "number", placeholder: "" },
    { name: "glucoseLevel", label: t.glucoseLabel, type: "number", placeholder: "" },
    { name: "emergencyContact", label: t.emergencyContactLabel || "Emergency Contact", type: "tel", placeholder: "e.g. 1234567890" },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 overflow-hidden py-10">
      {/* Background Shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-70" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full blur-3xl opacity-70" />
      <div className="absolute top-[40%] left-[60%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
      
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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass p-8 sm:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-[500px] z-10 mx-4 border border-white/60 mt-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{t.registerTitle}</h2>
          <p className="text-slate-500 font-medium">{t.registerSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {fields.map((field) => (
            <div key={field.name} className={`space-y-1 ${field.name === 'email' || field.name === 'password' || field.name === 'name' ? 'sm:col-span-2' : ''}`}>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                className="w-full bg-white/60 border border-slate-200/60 p-3.5 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800"
                onChange={(e) => {
                  const val = e.target.value;
                  if (field.name === "age" && Number(val) > 150) return;
                  setForm({ ...form, [field.name]: val });
                }}
                value={form[field.name] || ""}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleRegister}
          className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 mt-8"
        >
          {t.signUpBtn}
        </button>

        <p className="text-center mt-8 text-sm font-semibold text-slate-500">
          {t.hasAccountText}
          <span 
            className="text-indigo-600 hover:text-indigo-800 cursor-pointer transition"
            onClick={() => (window.location.href = "/login")}
          >
            {t.logInText}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

export default Register;