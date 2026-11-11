import { CryptoService } from "./crypto.service";

describe("CryptoService", () => {
  let service: CryptoService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    service = new CryptoService();
  });

  it("should encrypt and decrypt plaintext accurately", () => {
    const originalText = "ghp_secret_token_1234567890abcdef";
    const encrypted = service.encrypt(originalText);

    expect(encrypted.encryptedText).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars

    const decrypted = service.decrypt(
      encrypted.encryptedText,
      encrypted.iv,
      encrypted.tag,
    );

    expect(decrypted).toBe(originalText);
  });
});
