// Mirrors the user service rules so people see problems before submitting.

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  { id: 'mix', label: 'A letter and a number', test: (value: string) => /[a-z]/i.test(value) && /\d/.test(value) }
] as const;

export const passwordChecklist = (value: string) => PASSWORD_RULES.map(rule => ({ id: rule.id, label: rule.label, met: rule.test(value) }));

export function passwordProblem(value: string): string | null {
  if (!value) return 'Choose a password.';
  const failed = PASSWORD_RULES.find(rule => !rule.test(value));
  if (failed) return failed.id === 'length' ? 'Use at least 10 characters.' : 'Include at least one letter and one number.';
  if (value.length > 200) return 'Use 200 characters or fewer.';
  return null;
}

