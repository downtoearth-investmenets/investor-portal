'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homePathFor, useSession } from '@/shared/auth';
import { FullPageSpinner } from '@/shared/ui/States';

export default function HomePage() {
  const { status, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && user) router.replace(homePathFor(user.role));
  }, [status, user, router]);

  return <FullPageSpinner />;
}
