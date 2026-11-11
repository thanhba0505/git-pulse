import { CryptoService } from "./crypto.service";

describe("CryptoService", () => {
  let service: CryptoService;
  const mockMasterKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = mockMasterKey;
    delete process.env.NODE_ENV;
    delete process.env.APP_ENV;
    service = new CryptoService();
  });

  it("should encrypt and decrypt plaintext with per-user HKDF key derivation", () => {
    const userId = "user-12345-uuid";
    const originalText = "ghp_secret_token_1234567890abcdef";
    const encrypted = service.encrypt(originalText, userId);

    expect(encrypted.encryptedText).toBeDefined();
    expect(encrypted.iv).toHaveLength(24);
    expect(encrypted.tag).toHaveLength(32);
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = service.decrypt(
      encrypted.encryptedText,
      encrypted.iv,
      encrypted.tag,
      userId,
    );

    expect(decrypted).toBe(originalText);
  });

  it("should enforce cryptographic isolation across different user IDs", () => {
    const userA = "user-alice-uuid";
    const userB = "user-bob-uuid";
    const tokenA = "ghp_alice_private_pat_token";

    const encrypted = service.encrypt(tokenA, userA);

    // Attempting to decrypt userA's ciphertext using userB's ID must fail
    expect(() => {
      service.decrypt(
        encrypted.encryptedText,
        encrypted.iv,
        encrypted.tag,
        userB,
      );
    }).toThrow();
  });

  it("should decrypt legacy tokens encrypted without HKDF using fallback", () => {
    // Encrypt directly without userId (legacy mode)
    const legacyEncrypted = service.encrypt("ghp_legacy_token");

    // Decrypting with userId provided should fallback to master key cleanly
    const decrypted = service.decrypt(
      legacyEncrypted.encryptedText,
      legacyEncrypted.iv,
      legacyEncrypted.tag,
      "user-new-id",
    );

    expect(decrypted).toBe("ghp_legacy_token");
  });

  it("should throw critical fatal error in production if ENCRYPTION_KEY is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;

    expect(() => new CryptoService()).toThrow(
      "CRITICAL SECURITY FATAL: ENCRYPTION_KEY is strictly required in production environment",
    );
  });
});
