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

  async revoke(id: string): Promise<boolean> {
    // Conditional update (`revokedAt: null` in the WHERE clause) makes this
    // atomic at the database level: if two requests race to revoke the same
    // token, only one `updateMany` call affects a row, so only one caller
    // can proceed to mint a new token pair.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
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
