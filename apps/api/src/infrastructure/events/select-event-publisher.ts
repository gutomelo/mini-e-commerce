import { EventPublisher } from '../../application/ports/event-publisher.port';
import { FakeEventPublisher } from './fake-event-publisher';
import { QStashEventPublisher } from './qstash-event-publisher';

/** The only `EVENT_PUBLISHER_MODE` value that activates the real adapter. */
const REAL_MODE = 'real';

/**
 * Selects the {@link EventPublisher} implementation for `EventsModule`'s
 * `useFactory` provider, based on the `EVENT_PUBLISHER_MODE` environment
 * variable.
 *
 * Only the exact value `"real"` activates {@link QStashEventPublisher}.
 * Every other value — unset, empty, `"fake"`, or a typo like `"reall"` —
 * falls back to {@link FakeEventPublisher}, so a misconfigured environment
 * variable never silently starts publishing to a real Upstash account.
 *
 * Extracted as a standalone function (rather than inlined in the module's
 * `useFactory`) so it is unit-testable without booting a Nest application
 * context.
 */
export function selectEventPublisher(mode: string | undefined): EventPublisher {
  if (mode === REAL_MODE) {
    return new QStashEventPublisher();
  }

  return new FakeEventPublisher();
}
