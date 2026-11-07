/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Segoe UI Variable Display"',
          '"Segoe UI Variable Text"',
          '"IBM Plex Sans Arabic"',
          '"Segoe UI"',
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          '"Cascadia Mono"',
          '"Cascadia Code"',
          '"JetBrains Mono"',
          '"SF Mono"',
          "Consolas",
          "ui-monospace",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
