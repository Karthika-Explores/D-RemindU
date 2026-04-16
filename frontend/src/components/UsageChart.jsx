import { useEffect, useState } from "react";
import API from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

function UsageChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await API.get("/logs");

        const logs = res.data || [];

        // ✅ Group logs by date
        const grouped = {};

        logs.forEach((log) => {
          const date = new Date(log.createdAt).toLocaleDateString();

          if (!grouped[date]) {
            grouped[date] = { date, taken: 0, missed: 0 };
          }

          if (log.status === "Taken") {
            grouped[date].taken += 1;
          } else {
            grouped[date].missed += 1;
          }
        });

        setData(Object.values(grouped));

      } catch (error) {
        console.error("Chart error:", error);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="bg-white p-4 rounded-xl shadow-md mt-6">
      <h3 className="text-lg font-bold mb-4">📈 Medicine Usage</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />

          <Line type="monotone" dataKey="taken" stroke="#4CAF50" />
          <Line type="monotone" dataKey="missed" stroke="#F44336" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default UsageChart;