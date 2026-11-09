import { Suspense } from 'react';
import { AdminLoansView } from '@/features/admin/loans';

export default function AdminLoansPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoansView />
    </Suspense>
  );
}
