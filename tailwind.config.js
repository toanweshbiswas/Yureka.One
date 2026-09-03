/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./landing/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./shared/**/*.{js,ts,jsx,tsx}",
    "./backend/**/*.{js,ts,jsx,tsx}",
    "!**/node_modules/**",
    "!**/landing/_archive/**",
    "!**/dist/**",
  ],
  theme: {
    extend: {
      colors: {
        landing: {
          bg: '#000000',
          primary: '#def46e',
          sub: '#ffffff',
          ink: '#000000',
          muted: '#ffffff',
          caption: '#ffffff',
          body: '#ffffff',
        },
        cream: '#0a0a0a', 
        ink: 'rgba(255, 255, 255, 0.9)',   
        clay: '#00933b',
        surface: '#111111',
        'surface-hi': '#1a1a1a',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        cooper: ['"Cooper Black"', '"Cooper Std"', 'Fraunces', 'serif'],
        display: ['"Cooper Black"', '"Cooper Std"', 'Fraunces', 'serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        serif: ['"Cooper Black"', '"Cooper Std"', 'Fraunces', 'serif'],
        blackletter: ['"Cooper Black"', '"Cooper Std"', 'Fraunces', 'serif'],
        kanit: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        cirka: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'overpass-mono': ['"Space Mono"', 'monospace'],
      },
      lineHeight: {
        tight: '1.1',
        snug: '1.2',
      },
      animation: {
        'fade-in-up': 'fadeInUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      perspective: {
        '1000': '1000px',
      }
    },
  },
  plugins: [],
}
