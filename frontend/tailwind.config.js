/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter"',
          '"IBM Plex Sans Arabic"',
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        arabic: [
          '"IBM Plex Sans Arabic"',
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"Cascadia Mono"',
          '"Cascadia Code"',
          "Consolas",
          "ui-monospace",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
