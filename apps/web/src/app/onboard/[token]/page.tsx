import { AuthSetPasswordView } from '@/features/auth/set-password';

export const metadata = { title: 'Set up your account — Down to Earth Investments' };

export default function OnboardPage({ params }: { params: { token: string } }) {
  return <AuthSetPasswordView purpose="invite" token={params.token} />;
}

