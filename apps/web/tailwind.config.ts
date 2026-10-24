import type { Config } from 'tailwindcss';

// Tokens extraits de docs/maquette_dnpec_finale.html (voir docs/architecture-proposition.md §3).
// Vivent directement ici pour l'instant ; à extraire vers packages/ui si apps/mobile en a besoin.
/** Couleur lue dans une variable CSS « R G B » (app/globals.css), avec l'opacité de Tailwind. */
const c = (nom: string) => `rgb(var(--c-${nom}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs en variables (app/globals.css, canaux RVB pour l'opacité « /50 ») : maquette d'origine sur
        // l'accueil et la connexion (:root), charte de la refonte dans l'application (.contraste-aa, niveau AA),
        // thème sombre (.contraste-aa[data-theme="sombre"], tons bleu nuit). Refonte (étapes 1 et 2) : menu
        // ink-900, fonds pâles *-50, ambre des tâches en validation ; N6 : vert et gris clair assombris (AA).
        ink: { DEFAULT: c('ink'), dark: c('ink-fonce'), 900: c('ink-900'), 800: c('ink-800'), 50: c('ink-50') },
        gold: { DEFAULT: c('or'), soft: c('or-doux'), 50: c('or-50'), bord: c('or-bord') },
        ambre: { DEFAULT: c('ambre'), vif: c('ambre-vif'), fonce: c('ambre-fonce') },
        sage: { DEFAULT: c('sage'), soft: c('sage-doux'), 50: c('sage-50'), bord: c('sage-bord'), fonce: c('sage-fonce') },
        clay: { DEFAULT: c('clay'), soft: c('clay-doux'), 50: c('clay-50'), bord: c('clay-bord') },
        bleu: { DEFAULT: c('bleu'), 50: c('bleu-50') },
        accent: { DEFAULT: c('ink'), soft: c('ink-50') },
        surface: c('surface'),
        bg: c('fond'),
        line: { DEFAULT: c('trait'), doux: c('trait-doux'), fort: c('trait-fort') },
        // Fonds secondaires : très clair (en-têtes, zones), survol et sélection, gris (squelettes, pistes, puces).
        'fond-doux': c('fond-doux'),
        survol: c('survol'),
        'fond-gris': c('fond-gris'),
        // Bandeau du menu (toujours sombre) et texte posé sur l'or (toujours foncé).
        bandeau: c('bandeau'),
        'sur-or': c('sur-or'),
        text: { DEFAULT: c('texte'), muted: c('texte-doux'), faint: c('texte-faint'), fort: c('texte-fort') },
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
