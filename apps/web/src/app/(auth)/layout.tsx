import type { ReactElement, ReactNode } from 'react';

/**
 * Shared shell for `/register` and `/login`: a centered card on a plain
 * background. The root layout's `SiteHeader` already provides branding and
 * navigation, so this only needs to center the card. Kept as a Server
 * Component — there is no state or interaction at this level, only the form
 * components nested inside each page need to be client-rendered.
 */
export default function AuthLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-8 shadow-xs">
        {children}
      </div>
    </div>
  );
}
