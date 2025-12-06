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
        bgMain: "#020617",
        bgSurface: "#020617",
        bgSurfaceSoft: "#0F172A",
        borderSoft: "#1E293B",
        accentPrimary: "#2563EB",
        accentSuccess: "#22C55E",
        accentDanger: "#EF4444",
        accentNeutral: "#9CA3AF",
        accentHighlight: "#FACC15",
      },
    },
  },
  plugins: [],
};

export default config;

