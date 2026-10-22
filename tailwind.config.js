/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#010a13', 900: '#050f1e', 800: '#0a1628', 700: '#101f38', 600: '#182a48', 500: '#243a5e' },
        gold: { 50: '#faf5e8', 100: '#f0e6d2', 200: '#e3d1a4', 300: '#d4b97a', 400: '#c8aa6e', 500: '#b8934a', 600: '#9a7634', 700: '#785a28' },
        hex: { 300: '#6fe6dc', 400: '#2fd6c8', 500: '#0ac8b9', 600: '#0897ab', 700: '#06707f' },
        role: { top: '#e89b3c', jungle: '#3ec97b', mid: '#5b9cf6', adc: '#ef5b6e', support: '#b78cf5' },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(200,170,110,.35), 0 8px 30px -8px rgba(200,170,110,.35)',
        hex: '0 0 0 1px rgba(10,200,185,.4), 0 8px 30px -8px rgba(10,200,185,.45)',
      },
      keyframes: {
        glow: { '0%,100%': { boxShadow: '0 0 0 1px rgba(200,170,110,.5), 0 0 18px rgba(200,170,110,.25)' }, '50%': { boxShadow: '0 0 0 1px rgba(240,230,210,.9), 0 0 36px rgba(200,170,110,.6)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        rise: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { opacity: 0, transform: 'scale(.92)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        glow: 'glow 2.2s ease-in-out infinite',
        floaty: 'floaty 7s ease-in-out infinite',
        rise: 'rise .45s ease both',
        pop: 'pop .22s ease both',
      },
    },
  },
  plugins: [],
}
