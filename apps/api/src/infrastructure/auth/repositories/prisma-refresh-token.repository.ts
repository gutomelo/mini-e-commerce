import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../../application/auth/ports/refresh-token-repository.port';
import { NewRefreshToken, RefreshToken } from '../../../domain/auth/refresh-token.entity';
import { PrismaService } from '../../prisma/prisma.service';
import type { RefreshToken as PrismaRefreshToken } from '../../../generated/prisma/client';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(token: NewRefreshToken): Promise<RefreshToken> {
    const record = await this.prisma.refreshToken.create({ data: token });
    return toDomain(record);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return record ? toDomain(record) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function toDomain(record: PrismaRefreshToken): RefreshToken {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
  };
}
