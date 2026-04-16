import { useEffect, useState } from "react";
import API from "../services/api";

function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/user/profile");
        setUser(res.data);
      } catch (error) {
        console.error("Profile fetch error:", error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return <p className="text-center mt-4">Loading profile...</p>;
  }

  if (!user) {
    return <p className="text-center mt-4 text-red-500">Failed to load profile</p>;
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">👤 User Profile</h2>

      <div className="space-y-2">
        <p><b>Name:</b> {user.name || "N/A"}</p>
        <p><b>Email:</b> {user.email || "N/A"}</p>
      </div>
    </div>
  );
}

export default UserProfile;