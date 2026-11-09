/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        // Desktop width but a short window (e.g. 1366x768 laptops): tighten vertical spacing.
        xlshort: { raw: '(min-width: 1280px) and (max-height: 820px)' }
      },
      colors: {
        canvas: '#f6f4ef',
        surface: '#ffffff',
        sand: '#efebe1',
        line: '#e4ded1',
        ink: '#1d2420',
        muted: '#5f665f',
        forest: '#14201b',
        sage: {
          50: '#eef5f5',
          100: '#d9e9ea',
          200: '#b6d4d6',
          400: '#69a2a5',
          600: '#3f7477',
          700: '#335f61',
          800: '#284a4c'
        },
        bark: { DEFAULT: '#443a26', 600: '#5a4d33' }
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(29, 36, 32, 0.04), 0 6px 20px rgba(29, 36, 32, 0.04)',
        pop: '0 18px 48px rgba(29, 36, 32, 0.18)'
      },
      keyframes: {
        rise: { from: { transform: 'translateY(8px)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { transform: 'translateY(10px) scale(0.98)' }, to: { transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        grow: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        draw: { from: { strokeDasharray: '0 9999' } }
      },
      animation: {
        rise: 'rise 0.35s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'pop-in': 'pop-in 0.22s ease-out',
        'slide-in': 'slide-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in-left': 'slide-in-left 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)',
        grow: 'grow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        draw: 'draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) both'
      }
    }
  },
  plugins: []
};
