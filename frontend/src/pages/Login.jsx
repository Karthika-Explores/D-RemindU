const handleLogin = async () => {
  try {
    const res = await API.post("/auth/login", form);

    console.log("LOGIN RESPONSE:", res.data); // 🔥 ADD THIS

    localStorage.setItem("user", JSON.stringify(res.data));
    localStorage.setItem("token", res.data.token);

    window.location.href = "/dashboard";
  } catch (error) {
    console.log("LOGIN ERROR:", error.response); // 🔥 ADD THIS
    alert(error.response?.data?.message || "Error");
  }
};