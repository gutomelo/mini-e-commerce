import { parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('returns an empty array for undefined', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty/blank string', () => {
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('   ')).toEqual([]);
  });

  it('splits a comma-separated list into an array', () => {
    expect(parseCorsOrigins('http://a,http://b')).toEqual(['http://a', 'http://b']);
  });

  it('trims whitespace around each origin', () => {
    expect(parseCorsOrigins(' http://a , http://b ')).toEqual(['http://a', 'http://b']);
  });

  it('drops empty entries from trailing/duplicate commas', () => {
    expect(parseCorsOrigins('http://a,,http://b,')).toEqual(['http://a', 'http://b']);
  });
});
