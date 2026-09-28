import type { NextConfig } from 'next';
import anciensLiens from './anciens-liens.json';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Anciens formats de liens produits par l'API (déjà envoyés par email ou stockés
  // dans les notifications) : redirigés vers la page actuelle, sans migration des
  // données. Temporaires (307) pour rester modifiables. La liste est aussi lue par
  // le test des liens (tests/e2e/api/i_liens.js).
  async redirects() {
    return anciensLiens.map(({ source, destination }) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
