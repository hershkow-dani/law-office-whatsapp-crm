import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyMetaSignature } from '../src/engine/webhookSecurity.js';

describe('verifyMetaSignature', () => {
  const secret = 'my-app-secret';
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));

  it('accepts a correctly signed body', () => {
    const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const signature = 'sha256=' + createHmac('sha256', 'wrong-secret').update(body).digest('hex');
    expect(verifyMetaSignature(body, signature, secret)).toBe(false);
  });

  it('rejects a signature for a different body', () => {
    const signature = 'sha256=' + createHmac('sha256', secret).update(Buffer.from('{"tampered":true}')).digest('hex');
    expect(verifyMetaSignature(body, signature, secret)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
  });

  it('rejects a malformed signature without raising', () => {
    expect(verifyMetaSignature(body, 'not-a-valid-signature', secret)).toBe(false);
  });
});
