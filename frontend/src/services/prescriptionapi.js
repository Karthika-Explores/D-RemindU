import axios from 'axios';

export const uploadPrescription = async (selectedFile) => {
  const token = localStorage.getItem("token"); // 
  
  const formData = new FormData();
  // IMPORTANT: The key "image" must match upload.single("image") in the backend
  formData.append("image", selectedFile); 

  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/api/prescriptions/upload`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`, // 
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};