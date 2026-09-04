import type { Config } from 'tailwindcss';

// Tokens extraits de docs/maquette_dnpec_finale.html (voir docs/architecture-proposition.md §3).
// Vivent directement ici pour l'instant ; à extraire vers packages/ui si apps/mobile en a besoin.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1B2A6B', dark: '#142057' },
        gold: { DEFAULT: '#F0B429', soft: '#FDF1D6' },
        sage: { DEFAULT: '#1C8B4B', soft: '#E1F3E7' },
        clay: { DEFAULT: '#CE1126', soft: '#FBE3E5' },
        accent: { DEFAULT: '#1B2A6B', soft: '#E7E9F5' },
        surface: '#FFFFFF',
        bg: '#F5F6FA',
        line: '#E2E4EE',
        text: { DEFAULT: '#1C2233', muted: '#5C6270', faint: '#9298A8' },
        'flag-red': '#CE1126',
        'flag-green': '#1C8B4B',
      },
      fontFamily: {
        heading: ['var(--font-montserrat)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        lg: '10px',
        md: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config;
