import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../../../application/products/ports/product-repository.port';
import {
  NewProduct,
  Product,
  ProductListFilter,
  ProductListResult,
  ProductUpdate,
} from '../../../domain/catalog/product.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma, Product as PrismaProduct } from '../../../generated/prisma/client';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ProductListFilter): Promise<ProductListResult> {
    const where = buildWhere(filter);
    const orderBy = buildOrderBy(filter);

    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: records.map(toDomain), total };
  }

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.product.findFirst({ where: { id, isActive: true } });
    return record ? toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const record = await this.prisma.product.findFirst({ where: { slug, isActive: true } });
    return record ? toDomain(record) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.prisma.product.count({ where: { slug } });
    return count > 0;
  }

  async create(product: NewProduct): Promise<Product> {
    const record = await this.prisma.product.create({
      data: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl ?? null,
        categoryId: product.categoryId,
      },
    });
    return toDomain(record);
  }

  async update(id: string, update: ProductUpdate): Promise<Product> {
    const record = await this.prisma.product.update({ where: { id }, data: update });
    return toDomain(record);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}

/**
 * Only public (`isActive: true`) products are ever visible through `list`
 * — soft-deleted products behave as if they were purged.
 *
 * `search` matches case-insensitively against `name` and `description`;
 * `categorySlug` filters through the `category` relation; price bounds
 * apply directly to the stored `priceCents` integer.
 */
function buildWhere(filter: ProductListFilter): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: 'insensitive' } },
      { description: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  if (filter.categorySlug) {
    where.category = { slug: filter.categorySlug };
  }

  if (filter.minPriceCents !== undefined || filter.maxPriceCents !== undefined) {
    where.priceCents = {
      ...(filter.minPriceCents !== undefined ? { gte: filter.minPriceCents } : {}),
      ...(filter.maxPriceCents !== undefined ? { lte: filter.maxPriceCents } : {}),
    };
  }

  return where;
}

/** `sort=price:asc|desc` maps to the `priceCents` column; `sort=createdAt:asc|desc` is the default. */
function buildOrderBy(filter: ProductListFilter): Prisma.ProductOrderByWithRelationInput {
  if (filter.sortField === 'price') {
    return { priceCents: filter.sortDirection };
  }
  return { createdAt: filter.sortDirection };
}

function toDomain(record: PrismaProduct): Product {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    priceCents: record.priceCents,
    imageUrl: record.imageUrl,
    categoryId: record.categoryId,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
