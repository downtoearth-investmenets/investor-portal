import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export function PasswordChecklist({ items }: { items: { id: string; label: string; met: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {items.map(item => (
        <li key={item.id} className={cn('flex items-center gap-1.5 transition-colors', item.met ? 'text-emerald-700' : 'text-muted')}>
          <span className={cn('grid h-4 w-4 place-items-center rounded-full border', item.met ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-line')}>
            {item.met && <Check className="h-3 w-3" aria-hidden />}
          </span>
          {item.label}
          <span className="sr-only">{item.met ? '(done)' : '(not yet)'}</span>
        </li>
      ))}
    </ul>
  );
}

