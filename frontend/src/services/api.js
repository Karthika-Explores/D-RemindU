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
  timeout: 30000, // 30s timeout to allow cold-booting backends while catching dead connections
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

export default API;