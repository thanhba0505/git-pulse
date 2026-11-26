import { Injectable, Logger } from '@nestjs/common';
import { ServiceConnection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FullHealthResponseDto,
  HealthResponseDto,
  ServiceConnectionHealthDto,
} from './dto/health-response.dto';
import { APP_VERSION } from '../common/version';

const MAX_PROBE_TIMEOUT_MS = 5000;
const MIN_PROBE_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getCommitSha(): string | undefined {
    return (
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.RENDER_GIT_COMMIT ||
      process.env.GITHUB_SHA ||
      undefined
    );
  }

  /** Lightweight liveness check with zero database or external service calls. */
  check(): HealthResponseDto {
    const commit = this.getCommitSha();

    return {
      status: 'ok',
      service: 'git-pulse-server',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      ...(commit ? { commit } : {}),
    };
  }

  /** Deep readiness check verifying local database and all active service_connections. */
  async checkFull(): Promise<FullHealthResponseDto> {
    const dbStartedAt = Date.now();
    let database: 'connected' | 'disconnected' = 'connected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Database health check ping failed:', error);
      database = 'disconnected';
    }

    const dbLatencyMs = Date.now() - dbStartedAt;
    const commit = this.getCommitSha();

    if (database !== 'connected') {
      return {
        status: 'error',
        service: 'git-pulse-server',
        database,
        dbLatencyMs,
        services: [],
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
        ...(commit ? { commit } : {}),
      };
    }

    const connections = await this.prisma.serviceConnection.findMany({
      where: { isActive: true },
      orderBy: { slug: 'asc' },
    });

    const services = await Promise.all(
      connections.map((conn) => this.probeServiceConnection(conn)),
    );
    const hasPeerIssue = services.some((item) => item.status !== 'connected');

    return {
      status: hasPeerIssue ? 'degraded' : 'ok',
      service: 'git-pulse-server',
      database,
      dbLatencyMs,
      services,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      ...(commit ? { commit } : {}),
    };
  }

  private resolveTargetHealthUrl(conn: ServiceConnection): string {
    const cleanDomain = conn.domain.replace(/\/+$/, '');
    const cleanPrefix = conn.apiPrefix.replace(/\/+$/, '');

    let rawPath = '/health';
    if (conn.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)) {
      const candidate = (conn.metadata as Record<string, unknown>).healthPath;
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        rawPath = candidate.trim();
      }
    }

    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const safePath = normalizedPath.endsWith('/health-full') ? '/health' : normalizedPath;

    if (cleanPrefix && safePath.startsWith(`${cleanPrefix}/`)) {
      return `${cleanDomain}${safePath}`;
    }

    return `${cleanDomain}${cleanPrefix}${safePath}`;
  }

  private async probeServiceConnection(
    conn: ServiceConnection,
  ): Promise<ServiceConnectionHealthDto> {
    const url = this.resolveTargetHealthUrl(conn);
    const timeoutMs = Math.min(
      Math.max(conn.timeoutMs || MAX_PROBE_TIMEOUT_MS, MIN_PROBE_TIMEOUT_MS),
      MAX_PROBE_TIMEOUT_MS,
    );
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        return {
          slug: conn.slug,
          name: conn.name,
          url,
          status: 'degraded',
          httpStatus: response.status,
          latencyMs,
          error: `HTTP ${response.status}`,
        };
      }

      let status: 'connected' | 'degraded' = 'connected';
      try {
        const body = (await response.json()) as { status?: unknown };
        if (body && body.status === 'error') {
          status = 'degraded';
        }
      } catch {
        // Non-JSON 2xx response still indicates the endpoint is reachable.
      }

      return {
        slug: conn.slug,
        name: conn.name,
        url,
        status,
        httpStatus: response.status,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message.slice(0, 160) : 'Connection failed';

      return {
        slug: conn.slug,
        name: conn.name,
        url,
        status: 'unreachable',
        latencyMs,
        error: message,
      };
    }
  }
}
