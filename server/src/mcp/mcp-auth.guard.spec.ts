import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { McpAuthGuard, McpAuthenticatedRequest } from './mcp-auth.guard';
import { hashMcpToken, MCP_TOKEN_PREFIX } from './mcp.constants';
import { McpKeysService } from './mcp-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubService } from '../github/github.service';

describe('McpKeysService & McpAuthGuard', () => {
  const mockPrisma = {
    mcpApiKey: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGitHubService = {
    recordAuditLog: jest.fn().mockResolvedValue(undefined),
  };

  let service: McpKeysService;
  let guard: McpAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.mcpApiKey.update.mockResolvedValue({});
    service = new McpKeysService(
      mockPrisma as unknown as PrismaService,
      mockGitHubService as unknown as GitHubService,
    );
    guard = new McpAuthGuard(service);
  });

  it('creates an MCP key storing only SHA-256 hash and returning raw token once', async () => {
    mockPrisma.mcpApiKey.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'key-1',
        userId: data.userId,
        label: data.label,
        tokenHash: data.tokenHash,
        maskedPrefix: data.maskedPrefix,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date('2026-11-26T00:00:00Z'),
        updatedAt: new Date('2026-11-26T00:00:00Z'),
      }),
    );

    const result = await service.createKey('user-1', {
      label: 'Antigravity IDE',
      scopes: ['read:activity', 'write:tasks'],
      expiresInDays: 30,
    });

    expect(result.token.startsWith(MCP_TOKEN_PREFIX)).toBe(true);
    expect(result.key.maskedPrefix).toContain('••••');
    expect(result.key.scopes).toEqual(['read:activity', 'write:tasks']);

    const createCall = mockPrisma.mcpApiKey.create.mock.calls[0][0] as {
      data: { tokenHash: string };
    };
    expect(createCall.data.tokenHash).toBe(hashMcpToken(result.token));
    expect(createCall.data.tokenHash).not.toBe(result.token);
    expect(mockGitHubService.recordAuditLog).toHaveBeenCalledWith(
      'user-1',
      'MCP_KEY_CREATE',
      'SUCCESS',
      expect.any(String),
      undefined,
    );
  });

  it('rejects revoked, expired, and malformed MCP tokens', async () => {
    await expect(service.validateToken('invalid_token')).rejects.toThrow(UnauthorizedException);

    const validShapeToken = `${MCP_TOKEN_PREFIX}${'a'.repeat(40)}`;
    const tokenHash = hashMcpToken(validShapeToken);

    mockPrisma.mcpApiKey.findUnique.mockResolvedValueOnce({
      id: 'key-revoked',
      tokenHash,
      scopes: ['read:tasks'],
      revokedAt: new Date('2026-11-25T00:00:00Z'),
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'dev',
        email: 'dev@example.com',
        avatarUrl: null,
        role: 'USER',
        isActive: true,
      },
    });
    await expect(service.validateToken(validShapeToken)).rejects.toThrow(UnauthorizedException);

    mockPrisma.mcpApiKey.findUnique.mockResolvedValueOnce({
      id: 'key-expired',
      tokenHash,
      scopes: ['read:tasks'],
      revokedAt: null,
      expiresAt: new Date('2020-01-01T00:00:00Z'),
      user: {
        id: 'user-1',
        username: 'dev',
        email: 'dev@example.com',
        avatarUrl: null,
        role: 'USER',
        isActive: true,
      },
    });
    await expect(service.validateToken(validShapeToken)).rejects.toThrow(UnauthorizedException);
  });

  it('authenticates valid Bearer token and populates request user and scopes', async () => {
    const token = `${MCP_TOKEN_PREFIX}${'b'.repeat(40)}`;
    mockPrisma.mcpApiKey.findUnique.mockResolvedValueOnce({
      id: 'key-ok',
      tokenHash: hashMcpToken(token),
      scopes: ['read:activity', 'write:tasks'],
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      user: {
        id: 'user-1',
        username: 'dev',
        email: 'dev@example.com',
        avatarUrl: null,
        role: 'USER',
        isActive: true,
      },
    });

    const req: Partial<McpAuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(req.user?.id).toBe('user-1');
    expect(req.mcpScopes).toEqual(['read:activity', 'write:tasks']);
    expect(req.mcpKeyId).toBe('key-ok');
  });
});
