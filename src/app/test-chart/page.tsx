
"use client";

import type { FC } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const dummyData = [
  { label: "A", value: 10, value2: 15 },
  { label: "B", value: 20, value2: 22 },
  { label: "C", value: 15, value2: 10 },
  { label: "D", value: 25, value2: 30 },
  { label: "E", value: 18, value2: 20 },
];

const TestChartPage: FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '20px', fontFamily: 'sans-serif' }}>Minimal Recharts Test</h1>
      <p style={{ marginBottom: '10px', fontFamily: 'sans-serif' }}>
        If you see a chart below with axes (A, B, C, D, E on X-axis, numerical on Y-axis), grid lines, two data lines, and tooltips on hover, then Recharts is working correctly in isolation.
      </p>
      <div style={{ width: "100%", maxWidth: "700px", height: "400px", border: "1px solid #888888", margin: "0 auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dummyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid stroke="#eeeeee" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#888888" tick={{ fill: "#555555" }} />
            <YAxis stroke="#888888" tick={{ fill: "#555555" }} />
            <Tooltip
              wrapperStyle={{ backgroundColor: "#ffffff", border: "1px solid #cccccc", borderRadius: "3px", padding: "10px" }}
              labelStyle={{ fontWeight: "bold", color: "#333333" }}
              itemStyle={{ color: "#333333" }}
            />
            <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} name="Value 1" dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="value2" stroke="#82ca9d" strokeWidth={2} name="Value 2" dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: '20px', fontFamily: 'sans-serif' }}>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>Back to Home</a>
      </div>
    </div>
  );
};

export default TestChartPage;
