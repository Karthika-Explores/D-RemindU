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
await API.post("/medicines", data);
fetchMedicines(); // ✅ refresh list

export default API;