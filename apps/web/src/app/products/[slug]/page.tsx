import { formatPriceCents } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { ApiError } from '@/data-access/http-client';
import { getProduct, type Product } from '@/data-access/products';

import { AddToCartButton } from './_components/add-to-cart-button';

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function loadProduct(slug: string): Promise<Product> {
  try {
    return await getProduct(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return { title: product.name };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps): Promise<ReactElement> {
  const { slug } = await params;
  const product = await loadProduct(slug);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 md:flex-row md:gap-10">
      <div className="aspect-square w-full max-w-md overflow-hidden rounded-lg bg-muted md:w-1/2">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-xl font-semibold text-foreground">
            {formatPriceCents(product.priceCents)}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{product.description}</p>

        <AddToCartButton productId={product.id} />

        <Link href="/products" className="text-sm font-medium underline underline-offset-4">
          Back to products
        </Link>
      </div>
    </div>
  );
}
