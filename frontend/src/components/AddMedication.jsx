import { useState } from "react";
import API from "../services/api";

function AddMedication({ refresh }) {
  const [form, setForm] = useState({
    medicineName: "",
    dosage: "",
    instructions: "",
    reminderTime: "",
    totalTablets: "",
    tabletsPerDose: "",
    dosesPerDay: "",
    lowStockThreshold: ""
  });

  const handleAdd = async () => {
    try {
      await API.post("/medications", {
        ...form,
        totalTablets: Number(form.totalTablets),
        tabletsPerDose: Number(form.tabletsPerDose),
        dosesPerDay: Number(form.dosesPerDay),
        lowStockThreshold: Number(form.lowStockThreshold)
      });

      refresh();

      // Reset form
      setForm({
        medicineName: "",
        dosage: "",
        instructions: "",
        reminderTime: "",
        totalTablets: "",
        tabletsPerDose: "",
        dosesPerDay: "",
        lowStockThreshold: ""
      });

      alert("Medication added successfully");
    } catch {
      alert("Error adding medication");
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-lg w-full">
      <h3 className="text-lg font-bold mb-4">Add Medication</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        <input
          placeholder="Medicine Name"
          value={form.medicineName}
          onChange={(e) => setForm({ ...form, medicineName: e.target.value })}
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <input
          placeholder="Dosage (e.g., 500mg)"
          value={form.dosage}
          onChange={(e) => setForm({ ...form, dosage: e.target.value })}
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

        <input
          placeholder="Instructions"
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="time"
          value={form.reminderTime}
          onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="number"
          placeholder="Total Tablets"
          value={form.totalTablets}
          onChange={(e) => setForm({ ...form, totalTablets: e.target.value })}
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="number"
          placeholder="Tablets Per Dose"
          value={form.tabletsPerDose}
          onChange={(e) => setForm({ ...form, tabletsPerDose: e.target.value })}
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="number"
          placeholder="Doses Per Day"
          value={form.dosesPerDay}
          onChange={(e) => setForm({ ...form, dosesPerDay: e.target.value })}
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="number"
          placeholder="Low Stock Threshold"
          value={form.lowStockThreshold}
          onChange={(e) =>
            setForm({ ...form, lowStockThreshold: e.target.value })
          }
          className="p-2 border rounded focus:ring-2 focus:ring-blue-400"
        />

      </div>

      <button
        onClick={handleAdd}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Add Medication
      </button>
    </div>
  );
}

export default AddMedication;