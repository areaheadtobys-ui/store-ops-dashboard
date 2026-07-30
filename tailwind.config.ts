import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe7fe",
          200: "#bfd6fe",
          300: "#93bafc",
          400: "#6096f8",
          500: "#3b74f0", // primary corporate blue
          600: "#2657d6",
          700: "#2145ac",
          800: "#1f3a87",
          900: "#1e336d",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#0f1420",
        },
        subtle: {
          DEFAULT: "#f5f6f8",
          dark: "#161b28",
        },
        border: {
          DEFAULT: "#e4e7ec",
          dark: "#242c3d",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16, 24, 40, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
