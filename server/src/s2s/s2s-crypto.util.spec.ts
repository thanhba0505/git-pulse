import {
  generateS2SSignature,
  verifyS2SSignature,
  normalizeS2SPath,
  canonicalizeS2SBody,
} from "./s2s-crypto.util";

describe("Git Pulse S2SCryptoUtil", () => {
  const secret = "gp_test_secret_key_12345";
  const timestamp = "1773000000";
  const method = "POST";
  const path = "/api/v1/auth/login";
  const body = { username: "testuser", devBypass: true };

  it("should generate valid 64-char hex HMAC-SHA256 signature", () => {
    const sig = generateS2SSignature(secret, timestamp, method, path, body);
    expect(sig).toBeDefined();
    expect(sig).toHaveLength(64);
  });

  it("should verify signature successfully with exact same parameters", () => {
    const sig = generateS2SSignature(secret, timestamp, method, path, body);
    expect(verifyS2SSignature(secret, timestamp, method, path, sig, body)).toBe(
      true,
    );
  });

  it("should reject when body payload is tampered", () => {
    const sig = generateS2SSignature(secret, timestamp, method, path, body);
    expect(
      verifyS2SSignature(secret, timestamp, method, path, sig, {
        username: "tampered",
        devBypass: true,
      }),
    ).toBe(false);
  });

  it("should reject when timestamp is tampered", () => {
    const sig = generateS2SSignature(secret, timestamp, method, path, body);
    expect(
      verifyS2SSignature(secret, "1773000001", method, path, sig, body),
    ).toBe(false);
  });

  it("should reject invalid signature length or non-hex gracefully", () => {
    expect(verifyS2SSignature(secret, timestamp, method, path, "", body)).toBe(
      false,
    );
    expect(
      verifyS2SSignature(secret, timestamp, method, path, "invalid", body),
    ).toBe(false);
  });

  it("should normalize paths and canonicalize body accurately", () => {
    expect(normalizeS2SPath("api/v1/test")).toBe("/api/v1/test");
    expect(normalizeS2SPath("/api/v1/test?query=abc")).toBe("/api/v1/test");
    expect(canonicalizeS2SBody(null)).toBe("");
    expect(canonicalizeS2SBody(undefined)).toBe("");
    expect(canonicalizeS2SBody("raw_string")).toBe("raw_string");
  });
});
