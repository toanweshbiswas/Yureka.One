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
          bg: '#0d4428',
          primary: '#def46e',
          sub: '#ffffff',
          ink: '#000000',
          muted: 'rgba(255, 255, 255, 0.62)',
          caption: 'rgba(255, 255, 255, 0.72)',
          body: 'rgba(255, 255, 255, 0.88)',
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
        // Sitewide type system: Space Mono for headings (primary) + Playfair
        // Display italic for heading accents. Almarai for body/subheadings/context.
        // Legacy class names are kept so existing markup doesn't need touching . 
        // they resolve to one of these fonts.
        sans: ['Almarai', 'sans-serif'],
        heading: ['"Space Mono"', 'monospace'],
        serif: ['Almarai', 'sans-serif'],
        blackletter: ['"Playfair Display"', 'serif'],
        kanit: ['Almarai', 'sans-serif'],
        cirka: ['"Space Mono"', 'monospace'],
        'overpass-mono': ['Almarai', 'sans-serif'],
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
