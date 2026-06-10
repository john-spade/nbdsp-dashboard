import type { Config } from "tailwindcss";

/**
 * University of the Philippines-inspired palette.
 * Primary: UP Maroon. Accent: UP Forest Green / Gold.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: "#fbf2f3",
          100: "#f7e0e2",
          200: "#eebec3",
          300: "#e1939b",
          400: "#d05f6c",
          500: "#b53a49",
          600: "#7b1113", // UP Maroon
          700: "#660d10",
          800: "#560c0e",
          900: "#4a0d0f",
          950: "#290405",
        },
        gold: {
          400: "#f1c34a",
          500: "#e0b13a", // UP Gold accent
          600: "#c4942a",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
