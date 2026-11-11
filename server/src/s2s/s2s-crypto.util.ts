import * as crypto from "crypto";

/**
 * Normalizes endpoint path by stripping query parameters and ensuring leading slash
 */
export function normalizeS2SPath(path: string): string {
  const withoutQuery = path.split("?")[0] || path;
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

/**
 * Normalizes body payload to canonical string
 */
export function canonicalizeS2SBody(body?: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

/**
 * Generates an HMAC-SHA256 signature for S2S request
 */
export function generateS2SSignature(
  secret: string,
  timestamp: string | number,
  method: string,
  path: string,
  body?: unknown,
): string {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizeS2SPath(path);
  const bodyString = canonicalizeS2SBody(body);
  const payload = `${timestamp}.${normalizedMethod}.${normalizedPath}.${bodyString}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies an HMAC-SHA256 signature using constant-time comparison
 */
export function verifyS2SSignature(
  secret: string,
  timestamp: string | number,
  method: string,
  path: string,
  signature: string,
  body?: unknown,
): boolean {
  if (!signature || typeof signature !== "string") {
    return false;
  }
  const expected = generateS2SSignature(secret, timestamp, method, path, body);
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (sigBuffer.length !== expectedBuffer.length || sigBuffer.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
