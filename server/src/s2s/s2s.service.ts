import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServiceConnection } from "@prisma/client";
import { generateS2SSignature, normalizeS2SPath } from "./s2s-crypto.util";
import { encryptS2SSecret, decryptS2SSecret } from "./s2s-vault.util";

@Injectable()
export class S2SService implements OnModuleInit {
  private readonly logger = new Logger(S2SService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const existing = await this.prisma.serviceConnection.findUnique({
        where: { slug: "central-gateway" },
      });

      const rawApiKey =
        process.env.GATEWAY_S2S_KEY || "gp_to_gw_s2s_secret_2026";
      const rawIncomingSecret =
        process.env.GATEWAY_INCOMING_SECRET || "gw_to_gp_s2s_secret_2026";

      if (!existing) {
        await this.prisma.serviceConnection.create({
          data: {
            slug: "central-gateway",
            name: "Central Gateway & IAM Master",
            domain: (
              process.env.GATEWAY_URL || "http://localhost:5101"
            ).replace(/\/api\/v1\/?$/, ""),
            apiPrefix: "/api/v1",
            apiKey: encryptS2SSecret(rawApiKey),
            incomingSecret: encryptS2SSecret(rawIncomingSecret),
            isActive: true,
            timeoutMs: 10000,
            metadata: { iamMaster: true, ssoProvider: true },
          },
        });
        this.logger.log(
          "Seeded encrypted central-gateway S2S connection in Git Pulse.",
        );
      } else if (
        !existing.apiKey?.startsWith("enc:v1:") ||
        !existing.incomingSecret?.startsWith("enc:v1:")
      ) {
        // Transparent lazy migration: encrypt plaintext values in DB
        await this.prisma.serviceConnection.update({
          where: { slug: "central-gateway" },
          data: {
            apiKey: encryptS2SSecret(existing.apiKey || rawApiKey),
            incomingSecret: encryptS2SSecret(
              existing.incomingSecret || rawIncomingSecret,
            ),
          },
        });
        this.logger.log(
          "Migrated central-gateway connection secrets to encrypted format in DB.",
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Could not auto-seed central-gateway connection: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Get an active service connection by slug
   */
  async getConnection(slug: string): Promise<ServiceConnection | null> {
    return this.prisma.serviceConnection.findFirst({
      where: { slug, isActive: true },
    });
  }

  /**
   * Make an authenticated S2S HTTP call with HMAC-SHA256 signature
   */
  async call<T>(
    slug: string,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const connection = await this.getConnection(slug);
    if (!connection) {
      throw new NotFoundException(
        `Active service connection not found for slug: ${slug}`,
      );
    }

    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${connection.domain}${connection.apiPrefix}${cleanEndpoint}`;
    const targetPath = `${connection.apiPrefix}${cleanEndpoint}`;

    const rawApiKey = decryptS2SSecret(connection.apiKey);
    if (!rawApiKey) {
      throw new Error(
        `[S2S] Service connection '${slug}' does not have an apiKey configured`,
      );
    }

    const method = (options.method || "GET").toUpperCase();
    const timestamp = Date.now().toString();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-S2S-Service": "git-pulse",
      "X-S2S-Timestamp": timestamp,
      "X-S2S-Signature": generateS2SSignature(
        rawApiKey,
        timestamp,
        method,
        normalizeS2SPath(targetPath),
        options.body,
      ),
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      connection.timeoutMs,
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `S2S call to ${slug} (${url}) failed with status ${response.status}: ${errorText}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(
        `Failed S2S call to ${slug}: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
