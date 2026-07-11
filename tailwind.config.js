/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15110D", // warm near-black canvas
        "ink-soft": "#1E1813", // raised surface
        paper: "#EDE6DA", // warm off-white text
        amber: "#E0913D", // safelight accent
        muted: "#948C7F", // warm gray secondary text — 5.6:1 on ink, 5.3:1 on ink-soft (AA with headroom)
        line: "#2C2620", // subtle warm border
      },
      borderRadius: {
        sm: "3px",
      },
    },
  },
  plugins: [],
};
