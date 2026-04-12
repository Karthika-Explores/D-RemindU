import { useEffect, useState } from "react";
import API from "../services/api";

function WeeklyReport() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const res = await API.get("/reports/weekly");
      setReport(res.data);
    } catch {
      alert("Error loading report");
    }
  };

  if (!report) return <p>Loading report...</p>;

  return (
    <div style={{ border: "1px solid black", padding: 10 }}>
      <h3>Weekly Adherence Report</h3>

      <p>Taken: {report.taken}</p>
      <p>Missed: {report.missed}</p>

      {/* Progress Bar */}
      <div style={{ width: "100%", background: "#ddd", height: 20 }}>
        <div
          style={{
            width: `${report.adherence}%`,
            background: "green",
            height: "100%"
          }}
        />
      </div>

      <p>Adherence: {report.adherence}%</p>

      <h4>{report.message}</h4>
    </div>
  );
}

export default WeeklyReport;