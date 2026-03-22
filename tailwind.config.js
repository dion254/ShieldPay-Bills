/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: "#0f4c2a", light: "#1a6b3c", dark: "#083318", foreground: "#ffffff" },
        accent:    { DEFAULT: "#f59e0b", foreground: "#1a1a1a" },
        gold:      { DEFAULT: "#d97706", light: "#fbbf24" },
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:  "0 1px 4px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        panel: "0 4px 24px -4px rgb(0 0 0 / 0.10)",
        deep:  "0 20px 60px -10px rgb(0 0 0 / 0.20)",
        glow:  "0 0 40px rgb(15 76 42 / 0.15)",
      },
      animation: {
        "fade-in":  "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" },                                to: { opacity: "1" }                    },
        slideUp: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn: { from: { opacity: "0", transform: "translateX(20px)" }, to: { opacity: "1", transform: "translateX(0)" } },
      },
    },
  },
  plugins: [],
};
