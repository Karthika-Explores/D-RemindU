import { useState } from "react";
import API from "../services/api";
import { motion } from "framer-motion";

function Register() {
  const [form, setForm] = useState({});

  const handleRegister = async () => {
    try {
      await API.post("/auth/register", form);
      alert("Registered successfully");
      window.location.href = "/";
    } catch (error) {
      alert(error.response?.data?.message || "Error");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-500">

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-10 rounded-2xl shadow-2xl w-[400px]"
      >
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">
          Create Account
        </h2>

        <div className="flex flex-col gap-4">

          {["name","email","password","age","weight","glucoseLevel"].map(field => (
            <input
              key={field}
              type={field === "password" ? "password" : "text"}
              placeholder={field}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
              onChange={(e)=>setForm({...form,[field]:e.target.value})}
            />
          ))}

          <button
            onClick={handleRegister}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold transition"
          >
            Register
          </button>
        </div>

        <p
          className="text-center mt-5 text-sm text-blue-600 cursor-pointer"
          onClick={() => (window.location.href = "/")}
        >
          Already have an account? Login
        </p>
      </motion.div>
    </div>
  );
}

export default Register;