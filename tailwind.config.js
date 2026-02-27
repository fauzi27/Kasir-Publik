/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Membaca semua file di dalam folder src
  ],
  darkMode: 'class', // Penting untuk fitur Dark Mode ISZI
  theme: {
    extend: {
      colors: {
        // Bosku bisa kunci warna brand ISZI di sini agar konsisten
        brand: {
          dark: '#111827',
          primary: '#3b82f6',
          success: '#22c55e'
        }
      },
      animation: {
        'blink-slow': 'blink 2s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        }
      }
    },
  },
  plugins: [],
}
