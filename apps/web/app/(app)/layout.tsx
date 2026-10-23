'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { memoriserSuite } from '../../lib/auth/suite';
import { OrgProvider } from '../../lib/org/OrgProvider';
import { InterimProvider, useInterim } from '../../lib/interim/InterimProvider';
import { InterimBanner } from '../../components/interim/InterimBanner';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { MenuHaut } from '../../components/layout/MenuHaut';
import { ReauthProvider } from '../../lib/securite/ReauthProvider';
import { NavigationProvider } from '../../lib/navigation/NavigationProvider';
import { SqueletteApplication } from '../../components/ui/Squelette';
import { ToastProvider } from '../../components/ui/Toast';
import { DefilementVisible } from '../../components/layout/DefilementVisible';
import { useEcranLarge } from '../../lib/navigation/bandeau';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const large = useEcranLarge();

  // Session absente ou expirée (ex. lien d'email) : la page visée est
  // mémorisée et rouverte après la connexion (lib/auth/suite).
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    router.replace(memoriserSuite(window.location.pathname + window.location.search) ? '/login' : '/');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <SqueletteApplication />;
  }

  return (
    <OrgProvider>
      <InterimProvider>
       <ReauthProvider>
        <NavigationProvider>
        <ToastProvider>
        <DefilementVisible />
        {/* Menu en haut sur écran large (bandeau, onglets par groupe, sous-onglets) ; sur téléphone,
         * barre du haut et tiroir du menu, inchangés. Un seul des deux est rendu (`useEcranLarge`) :
         * jamais deux fois les mêmes liens dans la page. Le menu reste en place ; seule la page défile.
         * La bande tricolore reste sur les pages publiques.
         * `relative` (ici et sur <main>) : un élément en position absolue (texte « sr-only » des lecteurs
         * d'écran, menu…) sans ancêtre positionné se placerait par rapport à la page entière, échapperait
         * à overflow-hidden et ferait défiler la fenêtre, menu compris (contrôlé par x_mise_en_page_ui). */}
        <div className="contraste-aa relative flex h-screen flex-col overflow-hidden bg-bg">
          {large ? (
            <MenuHaut />
          ) : (
            <>
              <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <Topbar onMenuClick={() => setSidebarOpen(true)} />
            </>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <InterimBanner />
            <InterimScopedContent>{children}</InterimScopedContent>
          </div>
        </div>
        </ToastProvider>
        </NavigationProvider>
       </ReauthProvider>
      </InterimProvider>
    </OrgProvider>
  );
}

/** Remonte la page à chaque changement d'identité d'intérim (clé) : ses données
 * sont rechargées avec le nouvel en-tête X-Interim-For, jamais un mélange de
 * données vues en son nom propre et au nom du titulaire. */
function InterimScopedContent({ children }: { children: React.ReactNode }) {
  const { interim } = useInterim();
  return (
    <main key={interim?.titulaireId ?? 'self'} className="relative flex-1 overflow-y-auto overflow-x-hidden p-4 pb-16 md:px-7 md:pb-8 md:pt-6">
      {children}
    </main>
  );
}
