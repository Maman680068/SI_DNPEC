'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { OrgProvider } from '../../lib/org/OrgProvider';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  if (status !== 'authenticated') {
    return <div className="flex min-h-screen items-center justify-center text-text-muted">Chargement…</div>;
  }

  return (
    <OrgProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flag-stripe">
            <span className="flag-r" />
            <span className="flag-y" />
            <span className="flag-g" />
          </div>
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-16 md:p-7">{children}</div>
        </div>
      </div>
    </OrgProvider>
  );
}
