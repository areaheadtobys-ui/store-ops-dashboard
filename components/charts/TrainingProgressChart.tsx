"use client";

import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export default function TrainingProgressChart({
  labels,
  data,
}: {
  labels: string[];
  data: number[];
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "Completion rate",
            data,
            borderColor: "#3b74f0",
            backgroundColor: "rgba(59, 116, 240, 0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
        },
      }}
      height={220}
    />
  );
}
