/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
  "./src/**/*.{html,ts}",
],
  theme: {
    extend: {
      spacing: {
        '1/8': '12.5%', // For the grid markers
      },
    },
  },
  variants: {},
  plugins: [],
}

