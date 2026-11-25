const EXPIRATION_HEADER_NAMES = [
  'github-authentication-token-expiration',
  'x-api-key-expires-at',
  'x-key-expires-at',
  'x-key-expiration',
  'x-token-expires-at',
  'x-parabol-token-expiration',
  'token-expiration',
  'expires-at',
];

/**
 * Extracts expiration metadata from HTTP response headers or a JWT `exp` claim, if present.
 */
export function extractTokenExpiration(rawToken: string, headers?: Headers | null): Date | null {
  if (headers) {
    for (const headerName of EXPIRATION_HEADER_NAMES) {
      const rawValue = headers.get(headerName)?.trim();
      if (!rawValue) continue;
      const parsed = new Date(rawValue);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  const parts = rawToken.trim().split('.');
  if (parts.length === 3 && parts[1]) {
    try {
      const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        exp?: unknown;
      };
      if (typeof decoded.exp === 'number' && Number.isFinite(decoded.exp) && decoded.exp > 0) {
        return new Date(decoded.exp * 1000);
      }
    } catch {
      // Not a JWT payload
    }
  }

  return null;
}
