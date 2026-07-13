import { redirect } from 'next/navigation';

/**
 * The catalog (`/products`) is the storefront's entry point per the
 * Storefront spec's Architecture section; this route just redirects there
 * instead of serving the `create-next-app` starter template.
 */
export default function Home(): never {
  redirect('/products');
}
