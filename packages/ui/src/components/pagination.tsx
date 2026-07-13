import type { ReactElement } from 'react';

import { cn } from '../lib/utils.js';

export interface PaginationProps {
  /** Current 1-indexed page. */
  page: number;
  totalPages: number;
  /** Builds the href for a given target page, e.g. `(p) => \`/products?page=${p}\`` — lets the caller preserve its own query params (search, category, ...). */
  buildHref: (page: number) => string;
  className?: string;
}

/**
 * Presentational Previous/Next pagination control. Renders plain `<a>`
 * elements (like `ProductCard`) so this package stays framework agnostic;
 * the caller supplies `buildHref` to preserve its own query params.
 * Renders nothing when there's only one page.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: PaginationProps): ReactElement | null {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-4', className)}
    >
      {hasPrevious ? (
        <a
          href={buildHref(page - 1)}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Previous
        </a>
      ) : (
        <span aria-disabled="true" className="text-sm text-muted-foreground">
          Previous
        </span>
      )}

      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <a
          href={buildHref(page + 1)}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Next
        </a>
      ) : (
        <span aria-disabled="true" className="text-sm text-muted-foreground">
          Next
        </span>
      )}
    </nav>
  );
}
