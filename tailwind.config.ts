import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1419",
          1: "#141c24",
          2: "#1a2535",
          3: "#1f2d3d",
        },
        border: "#253347",
        text: {
          primary: "#d6e0eb",
          secondary: "#7f92a8",
          muted: "#4a5e75",
        },
        accent: {
          blue: "#3b82f6",
          green: "#22c55e",
          yellow: "#eab308",
          red: "#ef4444",
          orange: "#f97316",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
