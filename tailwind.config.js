/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      fontFamily: {
        sans: ['Fredoka', 'sans-serif'],
        body: ['Fredoka', 'sans-serif'],
        heading: ['Fredoka', 'sans-serif'],
        tech: ['Fredoka', 'sans-serif'],
        mono: ['Fredoka', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
