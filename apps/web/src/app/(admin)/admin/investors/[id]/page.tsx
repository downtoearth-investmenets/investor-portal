import { InvestorDetailView } from '@/features/admin/investor-detail';

export default function AdminInvestorPage({ params }: { params: { id: string } }) {
  return <InvestorDetailView id={decodeURIComponent(params.id)} />;
}

