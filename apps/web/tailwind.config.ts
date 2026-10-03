import type { Config } from 'tailwindcss';

// Tokens extraits de docs/maquette_dnpec_finale.html (voir docs/architecture-proposition.md §3).
// Vivent directement ici pour l'instant ; à extraire vers packages/ui si apps/mobile en a besoin.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refonte de l'interface (étapes 1 et 2) : nuances de la charte des maquettes validées
        // (menu ink-900, fonds pâles *-50, ambre des tâches en validation).
        ink: { DEFAULT: '#1B2A6B', dark: '#142057', 900: '#121C4D', 800: '#17235C', 50: '#EEF0F8' },
        gold: { DEFAULT: '#F0B429', soft: '#FDF1D6', 50: '#FDF4DC' },
        ambre: { DEFAULT: '#8A5A00', vif: '#B07A00' },
        // Socle N6 (accessibilité, WCAG 2.1 AA) : vert et gris clair lus dans des variables
        // (app/globals.css) — couleurs de la maquette sur l'accueil et la connexion, assombries juste
        // assez pour un contraste ≥ 4,5:1 dans l'application (.contraste-aa).
        sage: { DEFAULT: 'var(--couleur-sage)', soft: '#E1F3E7', 50: '#E3F2E8' },
        clay: { DEFAULT: '#CE1126', soft: '#FBE3E5', 50: '#FBE6E8' },
        accent: { DEFAULT: '#1B2A6B', soft: '#E7E9F5' },
        surface: '#FFFFFF',
        // Fond et traits : maquette d'origine sur l'accueil et la connexion, charte de la refonte dans
        // l'application (.contraste-aa, app/globals.css).
        bg: 'var(--couleur-fond)',
        line: 'var(--couleur-trait)',
        text: { DEFAULT: '#1C2233', muted: '#5C6270', faint: 'var(--couleur-texte-faint)' },
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
