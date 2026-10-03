/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--surface-canvas-rgb) / <alpha-value>)',
        panel: 'rgb(var(--surface-panel-rgb) / <alpha-value>)',
        elevated: 'rgb(var(--surface-elevated-rgb) / <alpha-value>)',
        hover: 'rgb(var(--surface-hover-rgb) / <alpha-value>)',
        active: 'rgb(var(--surface-active-rgb) / <alpha-value>)',
        tech: 'rgb(var(--color-tech-rgb) / <alpha-value>)',
        finance: 'rgb(var(--color-finance-rgb) / <alpha-value>)',
        food: 'rgb(var(--color-food-rgb) / <alpha-value>)',
        sports: 'rgb(var(--color-sports-rgb) / <alpha-value>)',
        documents: 'rgb(var(--color-documents-rgb) / <alpha-value>)',
        mathematics: 'rgb(var(--color-mathematics-rgb) / <alpha-value>)',
        success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        error: 'rgb(var(--color-error-rgb) / <alpha-value>)',
        info: 'rgb(var(--color-info-rgb) / <alpha-value>)',
        warning: 'rgb(var(--color-warning-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Geist Sans', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        'xs': ['12px', '18px'],
        'sm': ['13px', '20px'],
        'body': ['14px', '22px'],
        'md': ['16px', '24px'],
        'lg': ['18px', '26px'],
        'xl': ['21px', '28px'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
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
