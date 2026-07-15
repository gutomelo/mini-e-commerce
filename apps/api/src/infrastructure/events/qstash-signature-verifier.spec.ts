import { QStashSignatureVerifier } from './qstash-signature-verifier';

const verifyMock = jest.fn<Promise<boolean>, [{ signature: string; body: string; url?: string }]>();

jest.mock('@upstash/qstash', () => {
  return {
    Receiver: jest.fn().mockImplementation(() => ({
      verify: verifyMock,
    })),
  };
});

describe('QStashSignatureVerifier', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      QSTASH_CURRENT_SIGNING_KEY: 'current-key',
      QSTASH_NEXT_SIGNING_KEY: 'next-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolves true when the underlying Receiver verifies the signature', async () => {
    verifyMock.mockResolvedValue(true);
    const verifier = new QStashSignatureVerifier();

    await expect(verifier.verify('sig-1', '{"event":"payment.completed"}')).resolves.toBe(true);
    expect(verifyMock).toHaveBeenCalledWith({
      signature: 'sig-1',
      body: '{"event":"payment.completed"}',
    });
  });

  it('resolves false when the underlying Receiver resolves false', async () => {
    verifyMock.mockResolvedValue(false);
    const verifier = new QStashSignatureVerifier();

    await expect(verifier.verify('sig-2', 'body')).resolves.toBe(false);
  });

  it('resolves false (never rejects) when the underlying Receiver throws a SignatureError', async () => {
    verifyMock.mockRejectedValue(new Error('signature is invalid'));
    const verifier = new QStashSignatureVerifier();

    await expect(verifier.verify('bad-sig', 'body')).resolves.toBe(false);
  });

  it('passes API_QSTASH_DESTINATION_URL through as the url claim to check when configured', async () => {
    process.env.API_QSTASH_DESTINATION_URL = 'http://api:3001/api/v1/events/qstash';
    verifyMock.mockResolvedValue(true);
    const verifier = new QStashSignatureVerifier();

    await verifier.verify('sig-3', 'body');

    expect(verifyMock).toHaveBeenCalledWith({
      signature: 'sig-3',
      body: 'body',
      url: 'http://api:3001/api/v1/events/qstash',
    });
  });
});
