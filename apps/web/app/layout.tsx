import type { Metadata } from 'next';
import { Montserrat, Inter } from 'next/font/google';
import { AuthProvider } from '../lib/auth/AuthProvider';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "DNPEC · Système d'Information Interne",
  description: 'Coordination des tâches, communication et archives de la DNPEC.',
  icons: { icon: '/logo-dnpec.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
