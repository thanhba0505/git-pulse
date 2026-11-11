import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

export interface EncryptedData {
  encryptedText: string;
  iv: string;
  tag: string;
  keyVersion?: number;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly masterKey: Buffer;
  public readonly currentKeyVersion = 1;

  constructor() {
    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "production";
    const rawKey = process.env.ENCRYPTION_KEY;

    if (isProduction && !rawKey) {
      throw new Error(
        "CRITICAL SECURITY FATAL: ENCRYPTION_KEY is strictly required in production environment. Refusing to start.",
      );
    }

    if (!rawKey) {
      this.logger.warn(
        "ENCRYPTION_KEY not set. Using local development key. NEVER use this in production!",
      );
    }

    const keyToUse =
      rawKey ||
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    this.masterKey = Buffer.from(keyToUse, "hex");
    if (this.masterKey.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY must be a valid 64-character hex string (32 bytes / 256 bits).",
      );
    }
  }

  /**
   * Derives a dedicated per-user encryption key (DEK) using HKDF-SHA256
   * to ensure cryptographic isolation across tenant accounts.
   */
  private deriveKey(userId?: string): Buffer {
    if (!userId) {
      return this.masterKey;
    }

    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        this.masterKey,
        Buffer.from(userId, "utf8"),
        Buffer.from("git-pulse-token-v1", "utf8"),
        32,
      ),
    );
  }

  /**
   * Encrypts plaintext with AES-256-GCM using per-user derived key
   */
  encrypt(
    plainText: string,
    userId?: string,
  ): EncryptedData & { keyVersion: number } {
    const key = this.deriveKey(userId);
    const iv = crypto.randomBytes(12); // GCM recommended IV size is 12 bytes
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return {
      encryptedText: encrypted,
      iv: iv.toString("hex"),
      tag,
      keyVersion: this.currentKeyVersion,
    };
  }

  /**
   * Decrypts ciphertext with AES-256-GCM using per-user derived key.
   * Includes fallback to masterKey for smooth migration of legacy tokens.
   */
  decrypt(
    encryptedText: string,
    ivHex: string,
    tagHex: string,
    userId?: string,
  ): string {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    // 1. Try decrypting with Per-User Derived Key
    if (userId) {
      try {
        const userKey = this.deriveKey(userId);
        const decipher = crypto.createDecipheriv(this.algorithm, userKey, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      } catch {
        // Fallback to masterKey in case of legacy token encrypted without HKDF
      }
    }

    // 2. Decrypt with Master Key
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey,
      iv,
    );
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}
