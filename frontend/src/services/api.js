import axios from "axios";

const API = axios.create({
  // baseURL: "https://d-remindu.onrender.com/api", // Production URL
  baseURL: "http://localhost:5000/api", // Local development URL
});

// ✅ ADD THIS INTERCEPTOR
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