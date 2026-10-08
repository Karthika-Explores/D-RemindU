import axios from "axios";

// Dynamically select API base URL depending on environment & hostname
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
  }
  return "https://d-remindu.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  timeout: 60000, // 60s timeout to allow cold-booting Render instances
});

// Interceptor to automatically attach JWT token
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.authorization = `Bearer ${token}`;
  }
  return req;
}, (error) => {
  return Promise.reject(error);
});

// Helper to pre-warm the backend if sleeping
export const pingBackend = () => {
  try {
    API.get("/ping").catch(() => {});
  } catch (err) {
    // Ignore ping errors
  }
};

export default API;