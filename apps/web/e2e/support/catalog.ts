/**
 * Mirrors the fixed, deterministic seed data in `apps/api/prisma/seed.ts`.
 * Product ids are regenerated on every reseed (see `e2e/global-setup.ts`),
 * but names, slugs, and prices are constants — safe to hardcode here rather
 * than re-deriving them from an API call in every spec.
 */
export const SEEDED_PRODUCTS = {
  headphones: {
    slug: 'wireless-bluetooth-headphones',
    name: 'Wireless Bluetooth Headphones',
    priceCents: 12999,
  },
  fitnessWatch: {
    slug: 'smart-fitness-watch',
    name: 'Smart Fitness Watch',
    priceCents: 19999,
  },
} as const;

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
