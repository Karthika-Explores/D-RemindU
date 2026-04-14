const token = localStorage.getItem("token");

const formData = new FormData();
formData.append("file", selectedFile);

await axios.post(
  "https://d-remindu.onrender.com/api/prescriptions/upload",
  formData,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  }
);