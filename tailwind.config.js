/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      colors: {
        cosmic: {
          bg: '#050310',
          deep: '#02010a',
          card: '#0A0820',
        },
        star: {
          DEFAULT: '#eef2ff',
          dim: '#7a7a9e',
        },
        you: '#f472b6',     // pink — person A
        me: '#60a5fa',       // blue — person B
        us: '#c084fc',       // purple — shared events
        gold: '#fbbf24',     // anniversaries
        glow: {
          pink: '#f9a8d4',
          blue: '#93c5fd',
          purple: '#d8b4fe',
        },
      },
    },
  },
  plugins: [],
};
