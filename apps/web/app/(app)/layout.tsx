'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { OrgProvider } from '../../lib/org/OrgProvider';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <div className="flex min-h-screen items-center justify-center text-text-muted">Chargement…</div>;
  }

  return (
    <OrgProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <div className="flag-stripe">
            <span className="flag-r" />
            <span className="flag-y" />
            <span className="flag-g" />
          </div>
          <Topbar />
          <div className="flex-1 overflow-y-auto p-7 pb-16">{children}</div>
        </div>
      </div>
    </OrgProvider>
  );
}
