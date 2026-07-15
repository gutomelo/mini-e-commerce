import { Injectable } from '@nestjs/common';
import { ProcessedEventRepository } from '../../application/ports/processed-event-repository.port';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaProcessedEventRepository implements ProcessedEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claims `(correlationId, event)` with a single atomic `INSERT ... ON
   * CONFLICT DO NOTHING`, checked via the affected-row count returned by
   * `$executeRaw`. This is the same atomic-claim-before-processing pattern
   * already proven in `apps/inventory` and `apps/payment` — never a
   * find-then-insert check, which is race-prone under concurrent/redelivered
   * webhooks.
   */
  async tryClaim(correlationId: string, event: string): Promise<boolean> {
    const affectedRows = await this.prisma.$executeRaw`
      INSERT INTO "ProcessedEvent" ("correlationId", "event")
      VALUES (${correlationId}::uuid, ${event})
      ON CONFLICT DO NOTHING
    `;
    return affectedRows > 0;
  }
}
