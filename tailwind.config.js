/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'bg-color': '#050508',
        'surface-color': '#0d0d14',
        'surface-color-light': '#161622',
        'border-color': 'rgba(255, 255, 255, 0.1)',
        'text-primary': '#ffffff',
        'text-secondary': '#a1a1aa',
        'accent-primary': '#FBC815',
        'accent-primary-hover': '#e0b010',
        'accent-secondary': '#FF007F',
        'accent-tertiary': '#00F0FF',
        'status-success': '#10b981',
        'status-warning': '#FBC815',
        'status-error': '#FF007F',

      },
      fontFamily: {
        fredoka: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        sans: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        body: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        heading: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        tech: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        mono: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        pricedown: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
        roboto: ['var(--font-fredoka)', 'Fredoka', 'Fredoka One', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
