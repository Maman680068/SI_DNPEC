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
import { ReauthProvider } from '../../lib/securite/ReauthProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Session absente ou expirée (ex. lien d'email) : la page visée est
  // mémorisée et rouverte après la connexion (lib/auth/suite).
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    router.replace(memoriserSuite(window.location.pathname + window.location.search) ? '/login' : '/');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <div className="flex min-h-screen items-center justify-center text-text-muted">Chargement…</div>;
  }

  return (
    <OrgProvider>
      <InterimProvider>
       <ReauthProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flag-stripe">
              <span className="flag-r" />
              <span className="flag-y" />
              <span className="flag-g" />
            </div>
            <Topbar onMenuClick={() => setSidebarOpen(true)} />
            <InterimBanner />
            <InterimScopedContent>{children}</InterimScopedContent>
          </div>
        </div>
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
    <div key={interim?.titulaireId ?? 'self'} className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-16 md:p-7">
      {children}
    </div>
  );
}
