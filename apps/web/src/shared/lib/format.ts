const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const exactDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
// Timestamps (not plain dates) are shown in the viewer's own time zone.
const shortDateLocal = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

export const formatMoney = (value: number, withCents = false) =>
  (withCents ? exactDollars : wholeDollars).format(Number.isFinite(value) ? value : 0);

export const formatRate = (value: number) => `${Number(value).toFixed(2).replace(/\.?0+$/, '')}%`;

export const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  return iso.length === 10 ? shortDate.format(toDate(iso)) : shortDateLocal.format(new Date(iso));
};

export const formatDateParts = (iso: string) => {
  const date = toDate(iso);
  return { month: monthOnly.format(date), day: String(date.getUTCDate()) };
};

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** "Casey and Taylor Sample" -> "CT" */
export const initialsOf = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(word => word && word.toLowerCase() !== 'and')
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join('');

const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-03" -> "Mar" */
export const formatMonthShort = (key: string) => monthShort.format(toDate(`${key}-01`));
/** "2026-03" -> "March 2026" */
export const formatMonthLong = (key: string) => monthLong.format(toDate(`${key}-01`));

/** 12345 -> "$12.3k" */
export function formatCompactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${Math.round(value)}`;
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
