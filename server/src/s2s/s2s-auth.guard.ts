import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { verifyS2SSignature } from "./s2s-crypto.util";

@Injectable()
export class S2SAuthGuard implements CanActivate {
  private readonly logger = new Logger(S2SAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const s2sSignature = request.headers["x-s2s-signature"] as
      string | undefined;
    const s2sTimestamp = request.headers["x-s2s-timestamp"] as
      string | undefined;
    const s2sServiceSlug = request.headers["x-s2s-service"] as
      string | undefined;

    // Strict HMAC-SHA256 protocol: All 3 headers are mandatory
    if (!s2sSignature || !s2sTimestamp || !s2sServiceSlug) {
      throw new UnauthorizedException(
        "Missing required S2S signature headers (X-S2S-Signature, X-S2S-Timestamp, X-S2S-Service)",
      );
    }

    const now = Date.now();
    const ts = Number(s2sTimestamp);

    // Replay attack prevention: max 5-minute skew tolerance
    if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
      throw new UnauthorizedException(
        "S2S request timestamp expired or clock skew too high",
      );
    }

    // Look up connection by sender slug
    const connection = await this.prisma.serviceConnection.findFirst({
      where: {
        slug: s2sServiceSlug,
        isActive: true,
        incomingSecret: { not: null },
      },
    });

    if (!connection || !connection.incomingSecret) {
      this.logger.warn(
        `Unauthorized or unconfigured S2S service: '${s2sServiceSlug}'`,
      );
      throw new UnauthorizedException(
        `Unauthorized S2S service: ${s2sServiceSlug}`,
      );
    }

    const targetPath = request.originalUrl || request.url;

    const isValid = verifyS2SSignature(
      connection.incomingSecret,
      s2sTimestamp,
      request.method,
      targetPath,
      s2sSignature,
      request.body,
    );

    if (!isValid) {
      this.logger.warn(
        `Invalid S2S HMAC signature for service '${s2sServiceSlug}' on path: ${targetPath}`,
      );
      throw new UnauthorizedException("Invalid S2S HMAC signature");
    }

    request.serviceConnection = connection;
    return true;
  }
}
