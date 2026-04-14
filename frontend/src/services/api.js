import axios from "axios";

const API = axios.create({
  baseURL: "https://d-remindu.onrender.com/api"
});

// ✅ ADD THIS INTERCEPTOR
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});
// api.js
export const fetchMedications = async () => {
    const response = await API.get("/medications");
    return response.data; // Ensure you use response.data, not just 'data'
};

export default API;