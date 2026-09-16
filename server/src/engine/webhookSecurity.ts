import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw request
 * body, keyed with the Meta App's secret). Without this, anyone who guesses
 * a webhook URL could inject fake "incoming messages". Returns false (never
 * throws) so callers can respond 401 uniformly.
 */
export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.startsWith('sha256=') ? signatureHeader.slice('sha256='.length) : signatureHeader;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(provided, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
