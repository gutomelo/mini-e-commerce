import { Button, Input, Label } from '@mini-e-commerce/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { Category } from '@/data-access/categories';

export interface ProductFiltersProps {
  categories: Category[];
  search?: string;
  category?: string;
}

/**
 * Search + category filter bar. A plain `GET` `<form>` — the browser
 * navigates to `/products?search=...&category=...` on submit, which the
 * Server Component page then reads from `searchParams`. No client state or
 * JavaScript is needed for filtering to work.
 */
export function ProductFilters({
  categories,
  search,
  category,
}: ProductFiltersProps): ReactElement {
  const hasActiveFilters = Boolean(search || category);

  return (
    <form method="GET" action="/products" className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          name="search"
          type="search"
          placeholder="Search products..."
          defaultValue={search}
          className="w-56"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          defaultValue={category ?? ''}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit">Apply</Button>

      {hasActiveFilters ? (
        <Button asChild variant="ghost">
          <Link href="/products">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
