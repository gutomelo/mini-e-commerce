import { FakeEventPublisher } from './fake-event-publisher';
import { QStashEventPublisher } from './qstash-event-publisher';
import { selectEventPublisher } from './select-event-publisher';

describe('selectEventPublisher', () => {
  it('selects QStashEventPublisher when the mode is exactly "real"', () => {
    expect(selectEventPublisher('real')).toBeInstanceOf(QStashEventPublisher);
  });

  it.each([undefined, '', 'fake', 'bogus', 'REAL', 'reall'])(
    'falls back to FakeEventPublisher for mode %p',
    (mode) => {
      expect(selectEventPublisher(mode)).toBeInstanceOf(FakeEventPublisher);
    },
  );
});
