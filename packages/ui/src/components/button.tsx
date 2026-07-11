import type { ReactElement, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
}

/**
 * Placeholder button for the shared UI package.
 * Styling (Tailwind/Shadcn) arrives with the storefront in a later phase.
 */
export function Button({ children, onClick, variant = 'primary' }: ButtonProps): ReactElement {
  return (
    <button type="button" data-variant={variant} onClick={onClick}>
      {children}
    </button>
  );
}
