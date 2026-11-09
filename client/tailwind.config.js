/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gehu: {
          blue: '#0F2C59',
          gold: '#C5A880',
          dark: '#0B192C',
          light: '#F8F9FA',
          accent: '#1E3E62'
        }
      }
    },
  },
  plugins: [],
}
