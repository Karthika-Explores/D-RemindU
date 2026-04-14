import API from "./api";

/**
 * Uploads a prescription image to the backend.
 * The interceptor in api.js handles the Auth token automatically.
 */
export const uploadPrescription = async (selectedFile) => {
  const formData = new FormData();
  
  // This "image" key MUST match upload.single("image") in your backend controller
  formData.append("image", selectedFile); 

  const response = await API.post("/prescriptions/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};