import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { McpApiKey } from '@prisma/client';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { GitHubService, RequestMetadata } from '../github/github.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMcpKeyDto } from './dto/mcp-key.dto';
import {
  DEFAULT_MCP_SCOPES,
  hashMcpToken,
  maskMcpToken,
  MCP_SCOPES,
  MCP_TOKEN_PREFIX,
  McpScope,
} from './mcp.constants';

export interface McpKeySummary {
  id: string;
  label: string;
  maskedPrefix: string;
  scopes: McpScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateMcpKeyResponse {
  key: McpKeySummary;
  token: string;
}

export interface ValidatedMcpSession {
  keyId: string;
  user: AuthenticatedUser;
  scopes: McpScope[];
}

const VALID_SCOPE_SET = new Set<string>(MCP_SCOPES);

function normalizeScopes(rawScopes: readonly string[]): McpScope[] {
  const unique = new Set<McpScope>();
  for (const scope of rawScopes) {
    if (VALID_SCOPE_SET.has(scope)) {
      unique.add(scope as McpScope);
    }
  }
  return Array.from(unique);
}

@Injectable()
export class McpKeysService {
  private readonly logger = new Logger(McpKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gitHubService: GitHubService,
  ) {}

  private toSummary(row: McpApiKey): McpKeySummary {
    return {
      id: row.id,
      label: row.label,
      maskedPrefix: row.maskedPrefix,
      scopes: normalizeScopes(row.scopes),
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }

  async listKeys(userId: string): Promise<McpKeySummary[]> {
    const rows = await this.prisma.mcpApiKey.findMany({
      where: { userId },
      orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async createKey(
    userId: string,
    dto: CreateMcpKeyDto,
    meta?: RequestMetadata,
  ): Promise<CreateMcpKeyResponse> {
    const cleanLabel = dto.label.trim();
    if (!cleanLabel) {
      throw new BadRequestException('Tên MCP Key không được để trống.');
    }

    const scopes = dto.scopes ? normalizeScopes(dto.scopes) : [...DEFAULT_MCP_SCOPES];
    if (scopes.length === 0) {
      throw new BadRequestException('MCP Key phải có ít nhất một quyền (scope).');
    }

    const rawToken = `${MCP_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
    const tokenHash = hashMcpToken(rawToken);
    const maskedPrefix = maskMcpToken(rawToken);

    const expiresAt =
      dto.expiresInDays !== undefined
        ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const created = await this.prisma.mcpApiKey.create({
      data: {
        userId,
        label: cleanLabel,
        tokenHash,
        maskedPrefix,
        scopes,
        expiresAt,
      },
    });

    await this.gitHubService.recordAuditLog(
      userId,
      'MCP_KEY_CREATE',
      'SUCCESS',
      `Created MCP key "${cleanLabel}" with scopes [${scopes.join(', ')}]`,
      meta,
    );

    return {
      key: this.toSummary(created),
      token: rawToken,
    };
  }

  async revokeKey(userId: string, keyId: string, meta?: RequestMetadata) {
    const existing = await this.prisma.mcpApiKey.findFirst({
      where: { id: keyId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy MCP API Key.');
    }

    if (!existing.revokedAt) {
      await this.prisma.mcpApiKey.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });

      await this.gitHubService.recordAuditLog(
        userId,
        'MCP_KEY_REVOKE',
        'SUCCESS',
        `Revoked MCP key "${existing.label}" (${existing.id})`,
        meta,
      );
    }

    return { success: true };
  }

  async validateToken(rawToken: string): Promise<ValidatedMcpSession> {
    const cleanToken = rawToken.trim();
    if (!cleanToken.startsWith(MCP_TOKEN_PREFIX) || cleanToken.length < 32) {
      throw new UnauthorizedException('MCP API Key không hợp lệ.');
    }

    const candidateHash = hashMcpToken(cleanToken);
    const record = await this.prisma.mcpApiKey.findUnique({
      where: { tokenHash: candidateHash },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!record) {
      throw new UnauthorizedException('MCP API Key không tồn tại hoặc đã bị thu hồi.');
    }

    const storedBuf = Buffer.from(record.tokenHash, 'hex');
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    if (
      storedBuf.length !== candidateBuf.length ||
      !crypto.timingSafeEqual(storedBuf, candidateBuf)
    ) {
      throw new UnauthorizedException('MCP API Key không hợp lệ.');
    }

    if (record.revokedAt) {
      throw new UnauthorizedException('MCP API Key đã bị thu hồi.');
    }

    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('MCP API Key đã hết hạn.');
    }

    if (!record.user || !record.user.isActive) {
      throw new UnauthorizedException('Tài khoản sở hữu MCP Key không tồn tại hoặc đã bị khóa.');
    }

    // Update lastUsedAt asynchronously so tool calls incur zero extra DB latency.
    this.prisma.mcpApiKey
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: unknown) => {
        this.logger.debug(`Failed to update lastUsedAt for MCP key ${record.id}: ${String(err)}`);
      });

    return {
      keyId: record.id,
      user: {
        id: record.user.id,
        username: record.user.username,
        email: record.user.email,
        avatarUrl: record.user.avatarUrl,
        role: record.user.role,
      },
      scopes: normalizeScopes(record.scopes),
    };
  }
}
