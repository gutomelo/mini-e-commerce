import { Injectable } from '@nestjs/common';
import type { EventName } from '@mini-e-commerce/types';
import { EventPublisher } from '../../application/ports/event-publisher.port';

/** A single event recorded by {@link FakeEventPublisher}. */
export interface RecordedEvent<TData = unknown> {
  event: EventName;
  correlationId: string;
  data: TData;
}

/**
 * In-memory {@link EventPublisher} used as the default provider for tests
 * and local development (mirrors the fakes already built in
 * `apps/inventory`/`apps/payment` for the same purpose). Never talks to a
 * real broker; `publish` simply records the call so tests can assert on it.
 */
@Injectable()
export class FakeEventPublisher extends EventPublisher {
  private readonly events: RecordedEvent[] = [];

  publish<TData>(event: EventName, correlationId: string, data: TData): Promise<void> {
    this.events.push({ event, correlationId, data });
    return Promise.resolve();
  }

  /** Returns a snapshot array of every event recorded so far. */
  published(): RecordedEvent[] {
    return [...this.events];
  }
}
