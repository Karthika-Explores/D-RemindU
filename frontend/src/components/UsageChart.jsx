/**
 * UsageChart.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   This component draws an area chart (a line graph with a coloured fill
 *   under it) showing how many medicines the user TOOK vs MISSED each day
 *   for the last 7 days, using data fetched from the backend logs API.
 *
 * LIBRARY USED:  Recharts  (npm package already installed)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── IMPORTS ──────────────────────────────────────────────────────────────────
// React hooks we need:
//   useEffect  → run code after the component appears on screen (like onMount)
//   useState   → create a piece of state (data that can change over time)
import { useEffect, useState } from "react";

// API is a pre-configured Axios instance that sends HTTP requests to our backend
import API from "../services/api";

// Recharts building blocks used to construct the chart:
import {
  AreaChart,          // The root chart element — wraps everything else
  Area,               // One "layer" of the chart (one for Taken, one for Missed)
  XAxis,              // Horizontal axis — shows dates along the bottom
  YAxis,              // Vertical axis  — shows dose counts on the left
  Tooltip,            // Popup box that appears when you hover a data point
  CartesianGrid,      // Faint grid lines drawn behind the chart
  ResponsiveContainer // Wrapper that makes the chart fill its parent width
} from "recharts";


// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
// When the user hovers over a point on the chart, Recharts calls this component
// and passes it three props:
//   active  → boolean: is the mouse currently over a data point?
//   payload → array:   the data values at the hovered point (taken, missed)
//   label   → string:  the date label for the hovered point (e.g. "Sep 29")
//
// We use this instead of the default tooltip because it looks much nicer.
// ─────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  // Only render if the mouse is actually hovering over a point
  if (active && payload && payload.length) {
    return (
      // Dark glass-style card
      <div className="bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/50 text-xs">
        {/* Date shown at the top, e.g. "Sep 29" */}
        <p className="font-bold text-slate-300 mb-1.5 border-b border-slate-700/60 pb-1">{label}</p>

        {/* Loop over each metric (Taken and Missed) */}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              {/* Coloured label — colour comes from the Area's `stroke` prop */}
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                {/* Show "Taken" or "Missed" as a human-friendly label */}
                {entry.name === "taken" ? "Taken" : "Missed"}:
              </span>
              {/* The number value for that metric */}
              <span className="font-black text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Return null when not hovering — renders nothing
  return null;
};


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: UsageChart
// ─────────────────────────────────────────────────────────────────────────────
function UsageChart() {

  // `data` will hold an array of objects, one per day, e.g.:
  //   [
  //     { date: "Sep 23", taken: 2, missed: 1 },
  //     { date: "Sep 24", taken: 3, missed: 0 },
  //     ...
  //   ]
  // Initially it is empty; we fill it once the API call completes.
  const [data, setData] = useState([]);

  // ── FETCH DATA ON FIRST RENDER ────────────────────────────────────────────
  // The empty dependency array [] means "only run this once, when the component
  // first mounts onto the page" — like a constructor / componentDidMount.
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // GET /logs — returns an array of all medication log entries
        const res = await API.get("/logs");
        const logs = res.data || []; // use [] as fallback if the response is empty

        // ── GROUP LOGS BY DATE ────────────────────────────────────────────
        // We need to count how many logs per day are "taken" and how many are
        // "missed".  We use a plain object as a lookup table keyed by date string.
        // Example after processing:
        //   {
        //     "Sep 27": { date: "Sep 27", taken: 2, missed: 1 },
        //     "Sep 28": { date: "Sep 28", taken: 3, missed: 0 },
        //   }
        const grouped = {};

        logs.forEach((log) => {
          // Each log has either a `date` field or a `createdAt` timestamp
          const logDate = log.date || log.createdAt;

          // Convert the raw timestamp into a readable date string like "Sep 29"
          const date = logDate
            ? new Date(logDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "Unknown"; // Fallback if date is missing

          // Create a fresh entry for this date the first time we see it
          if (!grouped[date]) {
            grouped[date] = { date, taken: 0, missed: 0 };
          }

          // Normalise the status to lowercase so "Taken" and "taken" both match
          const status = String(log.status || "").toLowerCase();

          if (status === "taken") {
            grouped[date].taken += 1;   // Increment the taken counter for this day
          } else {
            grouped[date].missed += 1;  // Everything else counts as missed
          }
        });

        // Convert the object's values into an array, then take only the last 7 days
        // Object.values() → [{ date, taken, missed }, ...]
        // .slice(-7)       → keep only the last 7 elements
        const sortedData = Object.values(grouped).slice(-7);
        setData(sortedData); // Store in state so the chart re-renders with real data

      } catch (error) {
        // If the network request fails, print to console but don't crash the app
        console.error("UsageChart — failed to load logs:", error);
      }
    };

    fetchLogs(); // Call the async function defined above
  }, []); // ← empty array = run once on mount


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col items-center">

      {/* ── LEGEND ROW ────────────────────────────────────────────────────── */}
      {/* Shows colour-coded pills for "Taken" and "Missed", plus a "Last 7 Days" badge */}
      <div className="flex items-center justify-between w-full mb-4 px-1">
        <div className="flex items-center gap-4 text-xs font-bold">

          {/* Green "Taken" legend pill */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Taken
          </div>

          {/* Red "Missed" legend pill */}
          <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-600 px-2.5 py-1 rounded-full border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Missed
          </div>
        </div>

        {/* Small badge showing the time range */}
        <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
          Last 7 Days
        </span>
      </div>

      {/* ── CHART CONTAINER ───────────────────────────────────────────────── */}
      {/* Fixed 260px tall div that holds either the chart or the empty state */}
      <div className="w-full h-[260px] relative">

        {/* If there is no data yet, display a helpful empty-state message */}
        {data.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <span className="text-3xl mb-1">📊</span>
            <p className="text-xs font-semibold">No activity logs recorded yet</p>
          </div>
        ) : (
          // ResponsiveContainer stretches the chart to fill the available width
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              {/* ── GRADIENT DEFINITIONS ──────────────────────────────────── */}
              {/* SVG gradients used as the fill colour for each Area.         */}
              {/* They fade from a solid colour at the top to transparent at   */}
              {/* the bottom, creating the typical area-chart shading effect.  */}
              <defs>
                {/* Emerald green gradient for the "Taken" area */}
                <linearGradient id="colorTaken" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>

                {/* Rose red gradient for the "Missed" area */}
                <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Faint dashed horizontal grid lines — visual aid only */}
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#e2e8f0"
                opacity={0.6}
              />

              {/* X-Axis: reads the `date` field from each data object */}
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                axisLine={false}   // Hide the axis line itself
                tickLine={false}   // Hide the tick marks
              />

              {/* Y-Axis: shows integer counts (no decimal numbers) */}
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />

              {/* Replace Recharts' default tooltip with our custom styled one */}
              <Tooltip content={<CustomTooltip />} />

              {/* ── AREA FOR "TAKEN" DOSES ────────────────────────────────── */}
              {/* type="monotone" makes the line curve smoothly between points */}
              <Area
                type="monotone"
                dataKey="taken"               // Which field in `data` to plot
                stroke="#10b981"              // Green line colour
                strokeWidth={3}              // Line thickness
                fillOpacity={1}
                fill="url(#colorTaken)"      // Use the gradient we defined above
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }} // Dot on hover
              />

              {/* ── AREA FOR "MISSED" DOSES ───────────────────────────────── */}
              <Area
                type="monotone"
                dataKey="missed"              // Which field in `data` to plot
                stroke="#f43f5e"              // Red line colour
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorMissed)"     // Use the gradient we defined above
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />

            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Make this component available to other files via import
export default UsageChart;
