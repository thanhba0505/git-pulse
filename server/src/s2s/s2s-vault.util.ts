import * as crypto from "crypto";
import { Logger } from "@nestjs/common";

const logger = new Logger("S2SVault");
const S2S_PREFIX = "enc:v1:";

/**
 * Retrieves the local S2S_ENCRYPTION_KEY from environment.
 * Enforces 256-bit (32 bytes / 64 hex characters) entropy.
 */
export function getS2SEncryptionKey(): Buffer {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "production";
  const rawKey = process.env.S2S_ENCRYPTION_KEY;

  if (isProduction && !rawKey) {
    throw new Error(
      "CRITICAL SECURITY FATAL: S2S_ENCRYPTION_KEY is strictly required in production environment. Refusing to start.",
    );
  }

  if (!rawKey) {
    logger.warn(
      "S2S_ENCRYPTION_KEY not configured. Using local dev key. NEVER use this in production!",
    );
  }

  const keyHex =
    rawKey ||
    "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

  const keyBuffer = Buffer.from(keyHex, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "S2S_ENCRYPTION_KEY must be a valid 64-character hex string (32 bytes).",
    );
  }

  return keyBuffer;
}

/**
 * Encrypts an S2S secret (apiKey or incomingSecret) for storage in PostgreSQL at rest.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptS2SSecret(
  plaintext: string,
  customKey?: Buffer,
): string {
  if (!plaintext) {
    return plaintext;
  }

  // Idempotent: If already encrypted, return as is
  if (plaintext.startsWith(S2S_PREFIX)) {
    return plaintext;
  }

  const key = customKey || getS2SEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM recommended 12-byte IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return `${S2S_PREFIX}${iv.toString("hex")}:${tag}:${ciphertext}`;
}

/**
 * Decrypts an S2S secret retrieved from PostgreSQL into plaintext in RAM.
 * If stored value is not encrypted (e.g. legacy), returns plaintext directly for seamless migration.
 */
export function decryptS2SSecret(
  storedValue: string | null | undefined,
  customKey?: Buffer,
): string | null {
  if (!storedValue) {
    return null;
  }

  // Backward compatibility: If not encrypted with our envelope prefix, return as-is
  if (!storedValue.startsWith(S2S_PREFIX)) {
    return storedValue;
  }

  const key = customKey || getS2SEncryptionKey();
  const parts = storedValue.split(":");
  if (parts.length !== 5) {
    throw new Error(
      "Invalid S2S ciphertext format in service_connections table",
    );
  }

  const [, , ivHex, tagHex, ciphertextHex] = parts;
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error(
      "Corrupted S2S ciphertext segments in service_connections table",
    );
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
