import { AuthSetPasswordView } from '@/features/auth/set-password';

export const metadata = { title: 'Choose a new password — Down to Earth Investments' };

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return <AuthSetPasswordView purpose="reset" token={params.token} />;
}

