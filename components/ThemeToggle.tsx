"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-subtle dark:text-gray-400 dark:hover:bg-subtle-dark"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
