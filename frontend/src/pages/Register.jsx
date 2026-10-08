import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API, { pingBackend } from "../services/api";
import { translations } from "../utils/translations";
import DRemindULogo from "../components/DRemindULogo";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
    weight: "",
    glucoseLevel: "",
    emergencyContact: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  const t = translations[language] || translations["en-US"];

  useEffect(() => {
    // Pre-warm the backend immediately upon entering the registration page
    pingBackend();
  }, []);

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setDebugInfo("");

    if (!form.name?.trim() || !form.email?.trim() || !form.password || !form.age) {
      setErrorMessage("Please complete all required fields (Name, Email, Password, Age).");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      age: Number(form.age),
      emergencyContact: form.emergencyContact ? form.emergencyContact.trim() : "",
      ...(form.weight && String(form.weight).trim() !== "" ? { weight: Number(form.weight) } : {}),
      ...(form.glucoseLevel && String(form.glucoseLevel).trim() !== "" ? { glucoseLevel: Number(form.glucoseLevel) } : {})
    };

    setLoading(true);
    try {
      await API.post("/auth/register", payload);
      alert("Account created successfully. Please sign in.");
      navigate("/login");
    } catch (error) {
      console.error("Register error:", error, "Response:", error.response);
      const status = error.response?.status;
      const data = error.response?.data;
      setDebugInfo(`status=${status ?? "none"} | msg=${data?.message || error.message}`);

      let msg = "Server is waking up — please wait 30 seconds and try again.";
      if (data?.message) {
        msg = String(data.message);
      } else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        msg = "The server took too long to respond. Please wait a moment and try again.";
      } else if (!error.response || error.message === "Network Error") {
        msg = "Unable to reach the server. If this is the free cloud server, it is waking up from sleep. Please wait 30 seconds and try again.";
      } else if (status === 502 || status === 503 || status === 504) {
        msg = "The server is starting up — please wait 30 seconds and try again.";
      } else if (status >= 400 && status < 500) {
        msg = data?.message || "Registration failed. Please check your details and try again.";
      } else if (status === 500) {
        msg = data?.message || "Server error. Please try again in a few seconds.";
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col justify-between px-4 py-6 sm:py-10">
      {/* Top Bar: Language & DRemindU Yellow Brand mark */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between">
        <DRemindULogo size="md" subtitle={true} />

        <select
          className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 rounded-lg px-2.5 py-1.5 outline-none hover:border-slate-600 transition cursor-pointer shadow-xs"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            localStorage.setItem("language", e.target.value);
          }}
          title="Select language"
        >
          <option value="en-US">English (US)</option>
          <option value="hi-IN">Hindi (HI)</option>
          <option value="kn-IN">Kannada (KN)</option>
          <option value="ta-IN">Tamil (TA)</option>
        </select>
      </header>

      {/* Main Registration Card */}
      <main className="w-full max-w-xl mx-auto my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Create your patient account
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Set up your medical profile and emergency contacts for automated reminders.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-2 p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-medium flex items-start gap-2.5">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}
          {debugInfo && (
            <div className="mb-4 p-2 rounded bg-slate-950 border border-slate-700 text-yellow-400 text-[10px] font-mono break-all">
              🔍 {debugInfo}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Section 1: Account credentials */}
            <div className="space-y-3.5">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Account Credentials
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.nameLabel || "Full Name"} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full h-10 bg-slate-950 border border-slate-700/80 px-3 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.emailLabel || "Email"} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="sarah@example.com"
                    className="w-full h-10 bg-slate-950 border border-slate-700/80 px-3 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.passwordLabel || "Password"} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full h-10 bg-slate-950 border border-slate-700/80 pl-3 pr-9 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <line x1="2" x2="22" y1="2" y2="22" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Health Vitals */}
            <div className="space-y-3.5 pt-1">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Health Metrics & Baseline
              </h2>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.ageLabel || "Age"} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="130"
                      placeholder="e.g. 45"
                      className="w-full h-10 bg-slate-950 border border-slate-700/80 px-3 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.weightLabel || "Weight (kg)"}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 70"
                    className="w-full h-10 bg-slate-950 border border-slate-700/80 px-3 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.glucoseLabel || "Glucose (mg/dL)"}
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 110"
                    className="w-full h-10 bg-slate-950 border border-slate-700/80 px-3 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                    value={form.glucoseLevel}
                    onChange={(e) => setForm({ ...form, glucoseLevel: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.emergencyContactLabel || "Emergency Caregiver Contact"} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    placeholder="+1 234 567 8900"
                    className="w-full h-10 bg-slate-950 border border-slate-700/80 pl-9 pr-3 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                    value={form.emergencyContact}
                    onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Directly phoned when the one-tap Emergency SOS trigger is activated.</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-sm font-bold shadow-md shadow-yellow-400/20 hover:shadow-lg hover:shadow-yellow-400/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-slate-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>{t.signUpBtn || "Complete Registration"}</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              {t.hasAccountText || "Already registered? "}
              <Link to="/login" className="text-yellow-400 font-semibold hover:text-yellow-300 hover:underline">
                {t.logInText || "Sign in"}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <div className="py-2" />
    </div>
  );
}

export default Register;