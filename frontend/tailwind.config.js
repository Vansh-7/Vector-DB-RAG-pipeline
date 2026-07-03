/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0a',
        panel: '#111111',
        elevated: '#161616',
        hover: '#1a1a1a',
        active: '#222222',
        tech: '#a78bfa',
        finance: '#34d399',
        food: '#f97316',
        sports: '#38bdf8',
        documents: '#e879f9',
        mathematics: '#facc15',
        success: '#22c55e',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        brand: ['Space Grotesk', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs': ['11px', '16px'],
        'sm': ['12px', '18px'],
        'base': ['13px', '20px'],
        'md': ['14px', '22px'],
        'lg': ['16px', '24px'],
        'xl': ['18px', '28px'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '4px',
        md: '6px',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite',
        'log-slide-in': 'logSlideIn 120ms ease-out',
        'vector-insert': 'vectorInsert 600ms ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        logSlideIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        vectorInsert: {
          '0%': { r: '0', opacity: '0' },
          '60%': { r: '7', opacity: '1' },
          '80%': { r: '3.5' },
          '100%': { r: '4', opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
}
