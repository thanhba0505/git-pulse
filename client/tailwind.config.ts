import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: "#040714",
          subtle: "#070D1E",
          surface: "#0B132B",
        },
        pulsar: {
          cyan: "#06B6D4",
          "cyan-glow": "#22D3EE",
          emerald: "#10B981",
          "emerald-glow": "#34D399",
          violet: "#8B5CF6",
          "violet-glow": "#A78BFA",
          amber: "#F59E0B",
          "amber-glow": "#FBBF24",
        },
        astral: {
          card: "rgba(11, 19, 43, 0.7)",
          border: "rgba(6, 182, 212, 0.2)",
          "border-hover": "rgba(6, 182, 212, 0.45)",
          glow: "rgba(6, 182, 212, 0.15)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "orbit-spin": "spin 20s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
