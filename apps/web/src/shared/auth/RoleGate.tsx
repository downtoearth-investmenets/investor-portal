'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FullPageSpinner } from '@/shared/ui/States';
import { canEnterArea, homePathFor, type PortalArea } from './policies';
import { useSession } from './SessionProvider';

export function RoleGate({ area, children }: { area: PortalArea; children: ReactNode }) {
  const { status, user } = useSession();
  const router = useRouter();
  const allowed = status === 'authenticated' && canEnterArea(user?.role, area);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && user && !canEnterArea(user.role, area)) router.replace(homePathFor(user.role));
  }, [status, user, area, router]);

  if (!allowed) return <FullPageSpinner />;
  return <>{children}</>;
}
