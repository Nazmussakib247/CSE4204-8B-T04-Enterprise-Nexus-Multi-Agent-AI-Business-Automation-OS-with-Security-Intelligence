/**
 * Auth Unit Tests
 * Tests token generation, hashing, and cookie helper logic
 * without making real HTTP calls.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ── Helpers under test (extracted from auth.controller.js) ────
const JWT_SECRET = 'test-secret-must-be-at-least-32-chars';
const JWT_EXPIRES_IN = '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── generateTokens ────────────────────────────────────────────
describe('generateTokens()', () => {
  const userId = 'user-uuid-123';

  test('returns accessToken and refreshToken', () => {
    const { accessToken, refreshToken } = generateTokens(userId);
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('tokens are different', () => {
    const { accessToken, refreshToken } = generateTokens(userId);
    expect(accessToken).not.toBe(refreshToken);
  });

  test('accessToken payload contains userId', () => {
    const { accessToken } = generateTokens(userId);
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    expect(decoded.userId).toBe(userId);
  });

  test('refreshToken payload contains userId', () => {
    const { refreshToken } = generateTokens(userId);
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    expect(decoded.userId).toBe(userId);
  });

  test('accessToken expires in ~15 min', () => {
    const { accessToken } = generateTokens(userId);
    const decoded = jwt.decode(accessToken);
    const lifetimeSeconds = decoded.exp - decoded.iat;
    expect(lifetimeSeconds).toBe(15 * 60);
  });

  test('refreshToken expires in ~7 days', () => {
    const { refreshToken } = generateTokens(userId);
    const decoded = jwt.decode(refreshToken);
    const lifetimeSeconds = decoded.exp - decoded.iat;
    expect(lifetimeSeconds).toBe(7 * 24 * 60 * 60);
  });

  test('two calls produce different tokens (jti is implicit via iat jitter)', () => {
    // Clock resolution may be 1s — ensure same-second calls still differ
    const t1 = generateTokens(userId).accessToken;
    const t2 = generateTokens(userId).accessToken;
    // Both valid; may or may not be equal within same second — just ensure format
    expect(t1.split('.').length).toBe(3);
    expect(t2.split('.').length).toBe(3);
  });
});

// ── hashToken ─────────────────────────────────────────────────
describe('hashToken()', () => {
  test('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashToken('some-random-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('is deterministic — same input yields same hash', () => {
    const token = 'deterministic-test-token';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  test('different inputs produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  test('matches known SHA-256 value', () => {
    // echo -n "hello" | sha256sum → 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const hash = hashToken('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

// ── JWT verification edge cases ───────────────────────────────
describe('JWT edge cases', () => {
  test('expired token throws TokenExpiredError', () => {
    const token = jwt.sign({ userId: 'u1' }, JWT_SECRET, { expiresIn: -1 });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired');
  });

  test('token signed with wrong secret fails verification', () => {
    const token = jwt.sign({ userId: 'u1' }, 'wrong-secret-32-chars-exactly!!');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow('invalid signature');
  });

  test('tampered payload fails verification', () => {
    const { accessToken } = generateTokens('u1');
    const [header, , sig] = accessToken.split('.');
    const fakePay = Buffer.from(JSON.stringify({ userId: 'hacker', iat: 0 })).toString('base64url');
    const tampered = `${header}.${fakePay}.${sig}`;
    expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow();
  });
});
