import { Global, Module } from '@nestjs/common';
import { EventPublisher } from '../../application/ports/event-publisher.port';
import { ProcessedEventRepository } from '../../application/ports/processed-event-repository.port';
import { PrismaProcessedEventRepository } from './prisma-processed-event.repository';
import { selectEventPublisher } from './select-event-publisher';

/**
 * Provides the {@link EventPublisher} port application-wide.
 *
 * The active implementation is chosen at runtime by
 * {@link selectEventPublisher}, based on the `EVENT_PUBLISHER_MODE`
 * environment variable: `"real"` activates the `QStashEventPublisher`
 * adapter, and every other value (unset, empty, or a typo) falls back to
 * `FakeEventPublisher` — so `/verify-phase`, local dev, and any
 * misconfigured deployment never accidentally depend on a live Upstash
 * round-trip.
 */
@Global()
@Module({
  providers: [
    {
      provide: EventPublisher,
      useFactory: () => selectEventPublisher(process.env.EVENT_PUBLISHER_MODE),
    },
    { provide: ProcessedEventRepository, useClass: PrismaProcessedEventRepository },
  ],
  exports: [EventPublisher, ProcessedEventRepository],
})
export class EventsModule {}
