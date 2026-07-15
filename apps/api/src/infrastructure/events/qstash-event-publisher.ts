import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@upstash/qstash';
import type { EventEnvelope, EventName } from '@mini-e-commerce/types';
import { EventPublisher } from '../../application/ports/event-publisher.port';
import {
  resolveInventoryDestinationUrl,
  resolvePaymentDestinationUrl,
  resolveQStashToken,
} from './qstash-env';

/** A named destination this adapter fans an envelope out to. */
interface Destination {
  name: string;
  url: string | undefined;
}

/**
 * Real {@link EventPublisher} adapter backed by the official `@upstash/qstash`
 * Node SDK. Publishes the same envelope twice — once to inventory's webhook
 * (`QSTASH_DESTINATION_URL`) and once to payment's webhook
 * (`PAYMENT_QSTASH_DESTINATION_URL`) — as two independent, best-effort HTTP
 * calls rather than a QStash URL Group/topic.
 *
 * Each destination's failure is logged and swallowed independently: one
 * destination being unreachable never blocks or fails the other, and
 * `publish` never rethrows so a broker outage never fails the caller's
 * use case (e.g. checkout).
 */
@Injectable()
export class QStashEventPublisher extends EventPublisher {
  private readonly logger = new Logger(QStashEventPublisher.name);
  private readonly client: Client;

  constructor() {
    super();
    this.client = new Client({ token: resolveQStashToken() });
  }

  async publish<TData>(event: EventName, correlationId: string, data: TData): Promise<void> {
    const envelope: EventEnvelope<TData> = {
      event,
      correlationId,
      timestamp: new Date().toISOString(),
      data,
    };

    const destinations: Destination[] = [
      { name: 'inventory', url: resolveInventoryDestinationUrl() },
      { name: 'payment', url: resolvePaymentDestinationUrl() },
    ];

    const results = await Promise.allSettled(
      destinations.map((destination) => this.publishTo(destination, envelope)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const destination = destinations[index];
        this.logger.error(
          `Failed to publish "${event}" to destination "${destination.name}" (${destination.url ?? 'unset'}): ${
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          }`,
        );
      }
    });
  }

  private async publishTo<TData>(
    destination: Destination,
    envelope: EventEnvelope<TData>,
  ): Promise<void> {
    if (!destination.url) {
      throw new Error(`no destination URL configured for "${destination.name}"`);
    }

    await this.client.publishJSON({
      url: destination.url,
      body: envelope,
    });
  }
}
