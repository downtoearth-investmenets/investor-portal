import { Suspense } from 'react';
import { ReportExportView } from '@/features/reports/export';
import { FullPageSpinner } from '@/shared/ui/States';

export default function ReportsPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ReportExportView />
    </Suspense>
  );
}

