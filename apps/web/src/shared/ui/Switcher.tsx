'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { initialsOf } from '@/shared/lib/format';

export interface SwitcherItem {
  id: string;
  label: string;
  description?: string;
  meta?: ReactNode;
}

/**
 * Searchable dropdown for jumping between records (e.g. investors).
 * Arrow keys move, Enter picks, Escape closes.
 */
export function Switcher({
  items,
  value,
  onChange,
  label,
  searchPlaceholder = 'Search'
}: {
  items: SwitcherItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const current = items.find(item => item.id === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => [item.label, item.description].filter(Boolean).some(text => String(text).toLowerCase().includes(needle)));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(items.findIndex(item => item.id === value), 0));
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointer);
    };
    // Reset only when opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (id: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (id !== value) onChange(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(index => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[active];
      if (item) choose(item.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? 'none selected'}`}
        className="group -ml-2 flex max-w-full items-center gap-4 rounded-[22px] py-2 pl-2 pr-4 text-left outline-none transition-colors duration-200 hover:bg-sand/70 focus-visible:ring-2 focus-visible:ring-sage-600"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest text-base font-semibold text-sage-200" aria-hidden>
          {initialsOf(current?.label)}
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-semibold leading-tight tracking-tight sm:truncate sm:text-4xl">{current?.label ?? 'Choose'}</span>
          {current?.description && <span className="mt-0.5 block truncate text-sm text-muted">{current.description}</span>}
        </span>
        <ChevronsUpDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform duration-300', open && 'rotate-180 text-ink')} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(440px,calc(100vw-2.5rem))] origin-top-left animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="relative border-b border-line">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
              aria-label={`Search ${label.toLowerCase()}`}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-12 w-full bg-transparent pl-11 pr-4 text-sm outline-none placeholder:text-muted/70"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>}
            {filtered.map((item, index) => {
              const selected = item.id === value;
              return (
                <li
                  key={item.id}
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={selected}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(item.id)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors', index === active && 'bg-sand/80')}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
                      selected ? 'bg-forest text-sage-200' : 'bg-sand text-ink'
                    )}
                    aria-hidden
                  >
                    {initialsOf(item.label)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    {item.description && <span className="block truncate text-xs text-muted">{item.description}</span>}
                  </span>
                  {item.meta && <span className="shrink-0 text-xs text-muted">{item.meta}</span>}
                  <Check className={cn('h-4 w-4 shrink-0 text-sage-700', !selected && 'invisible')} aria-hidden />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

