/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#ECEFFE',
          100: '#D8DFFD',
          200: '#B5BFFA',
          300: '#8F9CF5',
          400: '#6D7AEF',
          500: '#5565D4',
          600: '#5565D4',
          700: '#4453C0',
          800: '#3340A8',
        },
        accent: {
          50:  '#FEF2EF',
          100: '#FDE3DC',
          200: '#FAC6BC',
          400: '#EB8070',
          600: '#E35D43',
          700: '#CB4E35',
        },
      },
    },
  },
  plugins: [],
}
