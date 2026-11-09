import { passwordProblem } from '@/shared/auth/password-policy';

export interface ChangePasswordForm {
  current: string;
  next: string;
  confirm: string;
}

export type ChangePasswordErrors = Partial<Record<keyof ChangePasswordForm, string>>;

export const EMPTY_CHANGE_PASSWORD: ChangePasswordForm = { current: '', next: '', confirm: '' };

export function validateChangePassword(form: ChangePasswordForm): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!form.current) errors.current = 'Enter your current password.';
  const problem = passwordProblem(form.next);
  if (problem) errors.next = problem;
  else if (form.next === form.current) errors.next = 'Choose a password you have not used here.';
  if (!form.confirm) errors.confirm = 'Type the new password again.';
  else if (form.confirm !== form.next) errors.confirm = 'The passwords do not match.';
  return errors;
}

export const roleLabel = (role?: string) => (role === 'admin' ? 'Administrator' : 'Investor');

