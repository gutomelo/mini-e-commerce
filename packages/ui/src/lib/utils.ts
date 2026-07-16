import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names, resolving conflicts (e.g. `p-2` vs `p-4`)
 * in favor of the last one specified. Standard shadcn/ui utility.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a price stored in cents as a localized currency string,
 * e.g. `formatPriceCents(3999)` -> `"$39.99"`.
 */
export function formatPriceCents(priceCents: number, locale = 'en-US', currency = 'USD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(priceCents / 100);
}
