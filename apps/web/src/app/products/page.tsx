import { Pagination, ProductCard } from '@mini-e-commerce/ui';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { listCategories } from '@/data-access/categories';
import { listProducts } from '@/data-access/products';

import { ProductFilters } from './_components/product-filters';

export const metadata: Metadata = {
  title: 'Products',
};

interface ProductsPageProps {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; category?: string }>;
}

interface ProductsFilters {
  search?: string;
  category?: string;
  /** Page size override, e.g. for a bookmarked/shared URL. Omitted keeps the API's default. */
  limit?: number;
}

function buildProductsHref(page: number, filters: ProductsFilters): string {
  const params = new URLSearchParams();
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.category) {
    params.set('category', filters.category);
  }
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `/products?${serialized}` : '/products';
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps): Promise<ReactElement> {
  const { page: pageParam, limit: limitParam, search, category } = await searchParams;
  const parsedPage = Number(pageParam);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedLimit = Number(limitParam);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

  const [productsResponse, categories] = await Promise.all([
    listProducts({ page, limit, search: search || undefined, category: category || undefined }),
    listCategories(),
  ]);

  const { data: products, meta } = productsResponse;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>

      <ProductFilters categories={categories} search={search} category={category} />

      {meta.total === 0 ? (
        <p className="text-sm text-muted-foreground">No products match your filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                slug={product.slug}
                name={product.name}
                priceCents={product.priceCents}
                imageUrl={product.imageUrl ?? undefined}
              />
            ))}
          </div>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            buildHref={(targetPage) => buildProductsHref(targetPage, { search, category, limit })}
          />
        </>
      )}
    </div>
  );
}
