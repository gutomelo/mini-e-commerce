import type { InputHTMLAttributes, ReactElement } from 'react';

import { cn } from '../lib/utils.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Shadcn-style text input. Purely presentational — form state, validation,
 * and submission belong to the consuming form (Server Action or React Hook
 * Form), never to this component.
 */
export function Input({ className, type, ...props }: InputProps): ReactElement {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'md:text-sm',
        className,
      )}
      {...props}
    />
  );
}
