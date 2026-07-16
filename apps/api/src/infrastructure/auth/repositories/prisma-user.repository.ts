import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../application/auth/ports/user-repository.port';
import { NewUser, User } from '../../../domain/auth/user.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type { User as PrismaUser } from '../../../generated/prisma/client';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? toDomain(record) : null;
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async create(user: NewUser): Promise<User> {
    const record = await this.prisma.user.create({ data: user });
    return toDomain(record);
  }
}

function toDomain(record: PrismaUser): User {
  return {
    id: record.id,
    email: record.email,
    passwordHash: record.passwordHash,
    name: record.name,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
