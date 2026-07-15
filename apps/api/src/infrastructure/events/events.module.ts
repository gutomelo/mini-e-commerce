import { Global, Module } from '@nestjs/common';
import { EventPublisher } from '../../application/ports/event-publisher.port';
import { FakeEventPublisher } from './fake-event-publisher';

/**
 * Provides the {@link EventPublisher} port application-wide.
 *
 * Defaults to {@link FakeEventPublisher} — matching Phases 4/5's "fake is
 * the default bean" convention — so `/verify-phase` and local dev never
 * depend on a live Upstash round-trip. The real `QStashEventPublisher`
 * adapter exists and is unit-tested, but is not wired as the active
 * provider until a later task switches it on.
 */
@Global()
@Module({
  providers: [{ provide: EventPublisher, useClass: FakeEventPublisher }],
  exports: [EventPublisher],
})
export class EventsModule {}
