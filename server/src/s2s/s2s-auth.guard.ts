import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { verifyS2SSignature } from "./s2s-crypto.util";

@Injectable()
export class S2SAuthGuard implements CanActivate {
  private readonly logger = new Logger(S2SAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"];
    const s2sSignature = request.headers["x-s2s-signature"] as
      string | undefined;
    const s2sTimestamp = request.headers["x-s2s-timestamp"] as
      string | undefined;
    const s2sServiceSlug = request.headers["x-s2s-service"] as
      string | undefined;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    // 1. If HMAC-SHA256 signature is provided, verify signature & replay protection
    if (s2sSignature && s2sTimestamp) {
      const now = Date.now();
      const ts = Number(s2sTimestamp);

      // Replay attack prevention: max 5-minute skew tolerance
      if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
        throw new UnauthorizedException(
          "S2S request timestamp expired or clock skew too high",
        );
      }

      const activeConnections = await this.prisma.serviceConnection.findMany({
        where: {
          isActive: true,
          incomingSecret: { not: null },
          ...(s2sServiceSlug ? { slug: s2sServiceSlug } : {}),
        },
      });

      const targetPath = request.originalUrl || request.url;

      const matched = activeConnections.find((conn) => {
        if (!conn.incomingSecret) return false;
        return verifyS2SSignature(
          conn.incomingSecret,
          s2sTimestamp,
          request.method,
          targetPath,
          s2sSignature,
          request.body,
        );
      });

      if (matched) {
        request.serviceConnection = matched;
        return true;
      }

      this.logger.warn(
        `S2S HMAC signature verification failed for path: ${targetPath}`,
      );
      throw new UnauthorizedException("Invalid S2S HMAC signature");
    }

    // 2. Fallback: Bearer token verification using timing-safe comparison
    if (token) {
      const connections = await this.prisma.serviceConnection.findMany({
        where: {
          isActive: true,
          incomingSecret: { not: null },
        },
      });

      const tokenBuffer = Buffer.from(token);

      const matched = connections.find((conn) => {
        if (!conn.incomingSecret) return false;
        const secretBuffer = Buffer.from(conn.incomingSecret);
        if (secretBuffer.length !== tokenBuffer.length) return false;
        return crypto.timingSafeEqual(secretBuffer, tokenBuffer);
      });

      if (matched) {
        request.serviceConnection = matched;
        return true;
      }

      throw new UnauthorizedException("Invalid service token");
    }

    throw new UnauthorizedException(
      "Missing Authorization or S2S signature headers",
    );
  }
}
