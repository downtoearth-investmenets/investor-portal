export type { InvestorSummary } from '@/features/portfolio';

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const todayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** "Sunday, November 8" */
export const todayLabel = (date: Date) => todayFormat.format(date);

/** Use the first name, including a second first name when joined with "and". */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 2 && parts.includes('and')) return parts.slice(0, -1).join(' ');
  return parts[0] ?? '';
}

