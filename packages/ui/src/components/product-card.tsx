import type { ReactElement } from 'react';

import { cn, formatPriceCents } from '../lib/utils.js';

export interface ProductCardProps {
  /** Product slug used to build the detail-page link (`/products/{slug}`). */
  slug: string;
  name: string;
  /** Price in cents, formatted as currency for display (e.g. `3999` -> `$39.99`). */
  priceCents: number;
  imageUrl?: string;
  imageAlt?: string;
  className?: string;
}

/**
 * Presentational catalog card: image, name, formatted price, and a link to
 * the product detail page. Fetching the product list/detail data is the
 * caller's responsibility (see apps/web's `data-access/products.ts`).
 *
 * Uses a plain `<a>` rather than `next/link` so this package stays framework
 * agnostic; the consuming Next.js app still gets working navigation, just
 * without client-side prefetching.
 */
export function ProductCard({
  slug,
  name,
  priceCents,
  imageUrl,
  imageAlt,
  className,
}: ProductCardProps): ReactElement {
  return (
    <a
      href={`/products/${slug}`}
      data-slot="product-card"
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border border-border bg-background transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt ?? name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium text-foreground">{name}</span>
        <span className="text-sm font-semibold text-foreground">
          {formatPriceCents(priceCents)}
        </span>
      </div>
    </a>
  );
}
