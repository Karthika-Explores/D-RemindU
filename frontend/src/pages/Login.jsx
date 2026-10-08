import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API, { pingBackend } from "../services/api";
import { translations } from "../utils/translations";
import DRemindULogo from "../components/DRemindULogo";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en-US");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const t = translations[language] || translations["en-US"];

  useEffect(() => {
    // Pre-warm the backend immediately upon entering the login page
    pingBackend();
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!form.email?.trim() || !form.password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password
      };
      const res = await API.post("/auth/login", payload);
      localStorage.setItem("user", JSON.stringify(res.data));
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error, "Response:", error.response);
      let msg = "Server is waking up — please wait 30 seconds and try again.";
      const status = error.response?.status;
      const data = error.response?.data;
      if (data?.message) {
        msg = data.message;
      } else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        msg = "The server took too long to respond. Please wait a moment and try again.";
      } else if (!error.response || error.message === "Network Error") {
        msg = "Unable to reach the server. If this is the free cloud server, it is waking up from sleep. Please wait 30 seconds and try again.";
      } else if (status === 502 || status === 503 || status === 504) {
        msg = "The server is starting up — please wait 30 seconds and try again.";
      } else if (status === 401 || status === 404) {
        msg = "Incorrect email or password.";
      } else if (status === 400) {
        msg = "Invalid request. Please check your details and try again.";
      } else if (status === 500) {
        msg = "Server error. Please try again in a few moments.";
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

      {/* Main Login Card */}
      <main className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Access your prescribed medication schedule and active health logs.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-medium flex items-start gap-2.5">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t.emailLabel || "Email address"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="w-full h-11 bg-slate-950 border border-slate-700/80 pl-10 pr-3.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {t.passwordLabel || "Password"}
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full h-11 bg-slate-950 border border-slate-700/80 pl-10 pr-10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-sm font-bold shadow-md shadow-yellow-400/20 hover:shadow-lg hover:shadow-yellow-400/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-slate-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>{t.signInBtn || "Sign In"}</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              {t.noAccountText || "Don't have an account? "}
              <Link to="/register" className="text-yellow-400 font-semibold hover:text-yellow-300 hover:underline">
                {t.createOneText || "Sign up"}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <div className="py-2" />
    </div>
  );
}

export default Login;