'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export const inputClasses =
  'h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/60 transition focus:border-sage-600 focus:outline-none focus:ring-4 focus:ring-sage-100 disabled:bg-sand';

interface FieldShellProps {
  label: string;
  error?: string | null;
  hint?: string;
  className?: string;
}

function FieldMessage({ id, error, hint }: { id: string; error?: string | null; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <p id={id} className={cn('mt-1.5 text-xs', error ? 'text-rose-600' : 'text-muted')}>
      {error || hint}
    </p>
  );
}

type TextFieldProps = FieldShellProps & InputHTMLAttributes<HTMLInputElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  labelAction?: ReactNode;
  inputClassName?: string;
};

export function TextField({ label, error, hint, className, id, leading, trailing, labelAction, inputClassName, ...props }: TextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const messageId = `${inputId}-message`;

  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        {leading && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sage-700">{leading}</div>}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(inputClasses, error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-100', leading && 'pl-11', trailing && 'pr-12', inputClassName)}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>}
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

type SelectFieldProps = FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>;

type TextAreaFieldProps = FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({ label, error, hint, className, id, rows = 3, ...props }: TextAreaFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const messageId = `${fieldId}-message`;

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(inputClasses, 'h-auto resize-y py-2.5 leading-relaxed', error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-100')}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({ label, error, hint, className, id, children, ...props }: SelectFieldProps) {
  const generated = useId();
  const selectId = id ?? generated;
  const messageId = `${selectId}-message`;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(inputClasses, 'appearance-none pr-10', error && 'border-rose-400')}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function CheckboxField({ label, className, ...props }: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3 text-sm text-ink', className)}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-line accent-sage-600 focus:ring-sage-600" {...props} />
      {label}
    </label>
  );
}
