import type { NextConfig } from 'next';
import anciensLiens from './anciens-liens.json';

// En-têtes de sécurité de toutes les pages (revue de sécurité 2026-10) : interdiction d'afficher
// l'application dans un cadre d'un autre site (clickjacking), HTTPS imposé, aucun type deviné,
// aucun référent envoyé (le jeton de réinitialisation est dans l'adresse de /reset-password),
// et une politique de contenu limitée au site et à l'API. Next exige les scripts en ligne.
const origineApi = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000').origin;
  } catch {
    return '';
  }
})();
const politiqueContenu = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${origineApi}`.trim(),
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const ENTETES_SECURITE = [
  { key: 'Content-Security-Policy', value: politiqueContenu },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: ENTETES_SECURITE }];
  },
  // Anciens formats de liens produits par l'API (déjà envoyés par email ou stockés
  // dans les notifications) : redirigés vers la page actuelle, sans migration des
  // données. Temporaires (307) pour rester modifiables. La liste est aussi lue par
  // le test des liens (tests/e2e/api/i_liens.js).
  async redirects() {
    return anciensLiens.map(({ source, destination }) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
