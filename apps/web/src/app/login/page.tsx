import { AuthLoginView, demoAccountGroups } from '@/features/auth/login';

export const metadata = {
  title: 'Sign In — Down to Earth Investments',
  description: 'Sign in to access your investor portal or administrator console.',
};

export default function LoginPage() {
  const showDemoAccounts = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO_ACCOUNT_PICKER === 'true';
  return <AuthLoginView demoAccounts={showDemoAccounts ? demoAccountGroups : []} />;
}

