import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../../application/categories/ports/category-repository.port';
import { Category, CategoryUpdate, NewCategory } from '../../../domain/catalog/category.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type { Category as PrismaCategory } from '../../../generated/prisma/client';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Category[]> {
    const records = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByNameOrSlug(name: string, slug: string): Promise<Category | null> {
    const record = await this.prisma.category.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    return record ? toDomain(record) : null;
  }

  async create(category: NewCategory): Promise<Category> {
    const record = await this.prisma.category.create({ data: category });
    return toDomain(record);
  }

  async update(id: string, update: CategoryUpdate): Promise<Category> {
    const record = await this.prisma.category.update({ where: { id }, data: update });
    return toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async countProductsByCategory(id: string): Promise<number> {
    return this.prisma.product.count({ where: { categoryId: id } });
  }
}

function toDomain(record: PrismaCategory): Category {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
