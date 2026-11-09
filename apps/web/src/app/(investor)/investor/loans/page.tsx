import { Suspense } from 'react';
import { InvestorLoansView } from '@/features/investor/loans';

export default function InvestorLoansPage() {
  return (
    <Suspense fallback={null}>
      <InvestorLoansView />
    </Suspense>
  );
}
