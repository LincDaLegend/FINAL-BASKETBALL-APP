/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/components/business/**/*.{jsx,js}',
    './app/**/*.{jsx,js}',
  ],
  corePlugins: {
    preflight: false, // keep legacy search styles intact
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
