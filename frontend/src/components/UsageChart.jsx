import { useEffect, useState } from "react";
import API from "../services/api";
import {
  AreaChart,
  Area,
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

        const grouped = {};
        logs.forEach((log) => {
          const date = new Date(log.createdAt).toLocaleDateString();
          if (!grouped[date]) {
            grouped[date] = { date, taken: 0, missed: 0 };
          }
          if (log.status.toLowerCase() === "taken") {
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
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTaken" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
          <Area type="monotone" dataKey="taken" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTaken)" />
          <Area type="monotone" dataKey="missed" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorMissed)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default UsageChart;