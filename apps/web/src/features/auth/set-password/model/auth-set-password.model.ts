import { passwordProblem } from '@/shared/auth/password-policy';
import type { LinkPurpose } from '../../model/link.model';

export interface SetPasswordValues {
  password: string;
  confirm: string;
}

export type SetPasswordErrors = Partial<Record<keyof SetPasswordValues, string>>;

export function validateSetPassword(values: SetPasswordValues): SetPasswordErrors {
  const errors: SetPasswordErrors = {};
  const problem = passwordProblem(values.password);
  if (problem) errors.password = problem;
  if (!values.confirm) errors.confirm = 'Type the password again.';
  else if (values.confirm !== values.password) errors.confirm = 'The passwords do not match.';
  return errors;
}

export const SET_PASSWORD_COPY: Record<LinkPurpose, { title: (name: string) => string; body: string; action: string; expiredAction: { label: string; href: string } }> = {
  invite: {
    title: name => (name ? `Welcome, ${name.split(' ')[0]}` : 'Welcome'),
    body: 'Choose a password to see your notes, payments, and the land behind them.',
    action: 'Create account',
    expiredAction: { label: 'Back to sign in', href: '/login' }
  },
  reset: {
    title: () => 'Choose a new password',
    body: 'You will be signed in on this device. Other devices will be signed out.',
    action: 'Save password',
    expiredAction: { label: 'Request a new link', href: '/forgot-password' }
  }
};

