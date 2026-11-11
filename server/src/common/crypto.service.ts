import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

export interface EncryptedData {
  encryptedText: string;
  iv: string;
  tag: string;
}

@Injectable()
export class CryptoService {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor() {
    const rawKey =
      process.env.ENCRYPTION_KEY ||
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    this.key = Buffer.from(rawKey, "hex");
    if (this.key.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
      );
    }
  }

  encrypt(plainText: string): EncryptedData {
    const iv = crypto.randomBytes(12); // GCM recommended IV size is 12 bytes
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return {
      encryptedText: encrypted,
      iv: iv.toString("hex"),
      tag,
    };
  }

  decrypt(encryptedText: string, ivHex: string, tagHex: string): string {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}
