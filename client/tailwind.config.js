/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        bg: 'var(--bg)',
        text: 'var(--text)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        'surface-hover': 'var(--surface-hover)',
      },
    },
  },
  plugins: [],
};
