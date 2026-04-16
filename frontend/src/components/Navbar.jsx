import { useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  return (
    <div className="flex justify-end p-4 bg-white shadow">
      <button
        onClick={() => navigate("/profile")}
        className="bg-gray-200 px-3 py-1 rounded"
      >
        👤 Profile
      </button>
    </div>
  );
}

export default Navbar;