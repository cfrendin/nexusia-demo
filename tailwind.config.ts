import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0B3D6B",
          secondary: "#1A7AB5",
          accent: "#00A5B5",
        },
        surface: "#F5F7FA",
      },
      fontFamily: {
        display: ["var(--font-plus-jakarta)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      animation: {
        "scan": "scan 1.8s ease-in-out forwards",
        "fade-up": "fadeUp 0.4s ease-out forwards",
        "slide-up": "slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pulse-mic": "pulseMic 1.5s ease-in-out infinite",
      },
      keyframes: {
        scan: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseMic: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 165, 181, 0.4)" },
          "50%": { boxShadow: "0 0 0 16px rgba(0, 165, 181, 0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
