"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ComplianceStatusChart({
  approved,
  pending,
  rejected,
  overdue,
}: {
  approved: number;
  pending: number;
  rejected: number;
  overdue: number;
}) {
  return (
    <Doughnut
      data={{
        labels: ["Approved", "Pending", "Rejected", "Overdue"],
        datasets: [
          {
            data: [approved, pending, rejected, overdue],
            backgroundColor: ["#22c55e", "#3b74f0", "#ef4444", "#f59e0b"],
            borderWidth: 0,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
        cutout: "70%",
      }}
      height={220}
    />
  );
}
