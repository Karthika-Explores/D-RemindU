import { useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("user", JSON.stringify(res.data));
      window.location.href = "/dashboard";
    } catch (error) {
      alert(error.response?.data?.message || "Error");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-2xl shadow-2xl w-[350px]"
      >
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-700">
          D RemindU
        </h2>

        <div className="flex flex-col gap-4">

          <input
            placeholder="Email"
            className="p-3 border rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="Password"
            className="p-3 border rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            onClick={handleLogin}
            className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg font-semibold transition"
          >
            Login
          </button>
        </div>

        <p
          className="text-center mt-5 text-sm text-purple-600 cursor-pointer"
          onClick={() => (window.location.href = "/register")}
        >
          New user? Register
        </p>
      </motion.div>
    </div>
  );
}

export default Login;