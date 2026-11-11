import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServiceConnection } from "@prisma/client";
import { generateS2SSignature, normalizeS2SPath } from "./s2s-crypto.util";

@Injectable()
export class S2SService implements OnModuleInit {
  private readonly logger = new Logger(S2SService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const existing = await this.prisma.serviceConnection.findUnique({
        where: { slug: "central-gateway" },
      });

      if (!existing) {
        await this.prisma.serviceConnection.create({
          data: {
            slug: "central-gateway",
            name: "Central Gateway & IAM Master",
            domain: (
              process.env.GATEWAY_URL || "http://localhost:5101"
            ).replace(/\/api\/v1\/?$/, ""),
            apiPrefix: "/api/v1",
            apiKey: process.env.GATEWAY_S2S_KEY || "gp_to_gw_s2s_secret_2026",
            incomingSecret:
              process.env.GATEWAY_INCOMING_SECRET || "gw_to_gp_s2s_secret_2026",
            isActive: true,
            timeoutMs: 10000,
            metadata: { iamMaster: true, ssoProvider: true },
          },
        });
        this.logger.log("Seeded central-gateway S2S connection in Git Pulse.");
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

    const method = (options.method || "GET").toUpperCase();
    const timestamp = Date.now().toString();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-S2S-Service": "git-pulse",
      "X-S2S-Timestamp": timestamp,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (connection.apiKey) {
      headers["Authorization"] = `Bearer ${connection.apiKey}`;
      headers["X-S2S-Signature"] = generateS2SSignature(
        connection.apiKey,
        timestamp,
        method,
        normalizeS2SPath(targetPath),
        options.body,
      );
    }

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
