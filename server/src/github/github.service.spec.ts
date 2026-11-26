import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GitHubService } from './github.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';

describe('GitHubService', () => {
  let service: GitHubService;
  let prismaMock: {
    gitAccount: {
      upsert: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    tokenAuditLog: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let cryptoMock: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      gitAccount: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
      tokenAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
    };

    cryptoMock = {
      encrypt: jest.fn().mockReturnValue({
        encryptedText: 'enc_text',
        iv: 'iv_hex',
        tag: 'tag_hex',
        keyVersion: 1,
      }),
      decrypt: jest.fn().mockReturnValue('ghp_decrypted_token'),
    };

    service = new GitHubService(
      prismaMock as unknown as PrismaService,
      cryptoMock as unknown as CryptoService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('savePersonalAccessToken', () => {
    it('should reject empty token', async () => {
      await expect(service.savePersonalAccessToken('user-1', '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should deactivate previous active account, detect scopes, and save new active account', async () => {
      const mockGhUser = {
        login: 'octocat',
        id: 1,
        avatar_url: 'https://avatar.url',
        name: 'Octocat',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGhUser,
        headers: {
          get: (name: string) => {
            if (name === 'x-oauth-scopes') return 'repo, delete_repo, admin:org';
            if (name === 'github-authentication-token-expiration') return '2026-12-31 00:00:00 UTC';
            return null;
          },
        },
      } as unknown as Response);

      prismaMock.gitAccount.upsert.mockResolvedValue({
        id: 'acc-1',
        gitUsername: 'octocat',
        gitAvatar: 'https://avatar.url',
        authType: 'PAT',
        scopes: ['repo', 'delete_repo', 'admin:org'],
        hasExcessiveScopes: true,
        tokenStatus: 'ACTIVE',
        isActive: true,
        expiresAt: new Date('2026-12-31 00:00:00 UTC'),
      });

      const result = await service.savePersonalAccessToken('user-1', 'ghp_token_with_admin_scopes');

      expect(result.hasExcessiveScopes).toBe(true);
      expect(result.expiresAt).toBeDefined();
      expect(result.isActive).toBe(true);
      expect(prismaMock.gitAccount.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isActive: false },
      });
      expect(cryptoMock.encrypt).toHaveBeenCalledWith('ghp_token_with_admin_scopes', 'user-1');
      expect(prismaMock.tokenAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('switchActiveAccount', () => {
    it('should throw NotFoundException if account does not belong to user', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue(null);
      await expect(service.switchActiveAccount('user-1', 'acc-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should switch active account and return updated status with all accounts', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-2',
        userId: 'user-1',
        gitUsername: 'work-dev',
      });
      prismaMock.gitAccount.findMany.mockResolvedValue([
        {
          id: 'acc-2',
          gitUsername: 'work-dev',
          gitAvatar: 'https://work.avatar',
          authType: 'PAT',
          scopes: ['repo'],
          hasExcessiveScopes: false,
          tokenStatus: 'ACTIVE',
          expiresAt: null,
          lastSyncAt: null,
          isActive: true,
        },
        {
          id: 'acc-1',
          gitUsername: 'octocat',
          gitAvatar: 'https://octo.avatar',
          authType: 'OAUTH',
          scopes: ['repo'],
          hasExcessiveScopes: false,
          tokenStatus: 'ACTIVE',
          expiresAt: null,
          lastSyncAt: null,
          isActive: false,
        },
      ]);

      const status = await service.switchActiveAccount('user-1', 'acc-2');

      expect(status.connected).toBe(true);
      expect(status.activeAccountId).toBe('acc-2');
      expect(status.gitUsername).toBe('work-dev');
      expect(status.accounts).toHaveLength(2);
    });
  });

  describe('getDecryptedToken', () => {
    it('should throw NotFoundException if account not connected', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue(null);
      await expect(service.getDecryptedToken('user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if token is REVOKED', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        tokenStatus: 'REVOKED',
        encryptedToken: 'enc',
        tokenIv: 'iv',
        tokenTag: 'tag',
      });

      await expect(service.getDecryptedToken('user-1')).rejects.toThrow(
        'GitHub token hiện ở trạng thái REVOKED',
      );
    });

    it('should decrypt active account using per-user derived key and audit log', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        tokenStatus: 'ACTIVE',
        encryptedToken: 'enc_data',
        tokenIv: 'iv_data',
        tokenTag: 'tag_data',
        gitUsername: 'octocat',
      });

      const res = await service.getDecryptedToken('user-1', 'STANDUP_SCAN');

      expect(res.token).toBe('ghp_decrypted_token');
      expect(res.username).toBe('octocat');
      expect(res.accountId).toBe('acc-1');
      expect(cryptoMock.decrypt).toHaveBeenCalledWith('enc_data', 'iv_data', 'tag_data', 'user-1');
      expect(prismaMock.tokenAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'STANDUP_SCAN',
            status: 'SUCCESS',
          }),
        }),
      );
    });
  });

  describe('disconnect', () => {
    it('should selectively remove a single account and promote remaining active account', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        gitUsername: 'octocat',
      });
      prismaMock.gitAccount.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.gitAccount.findMany
        .mockResolvedValueOnce([
          {
            id: 'acc-2',
            gitUsername: 'work-dev',
            isActive: false,
            authType: 'PAT',
            scopes: [],
            hasExcessiveScopes: false,
            tokenStatus: 'ACTIVE',
            expiresAt: null,
            lastSyncAt: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'acc-2',
            gitUsername: 'work-dev',
            isActive: true,
            authType: 'PAT',
            scopes: [],
            hasExcessiveScopes: false,
            tokenStatus: 'ACTIVE',
            expiresAt: null,
            lastSyncAt: null,
          },
        ]);

      const res = await service.disconnect('user-1', undefined, 'acc-1');

      expect(prismaMock.gitAccount.deleteMany).toHaveBeenCalledWith({
        where: { id: 'acc-1', userId: 'user-1' },
      });
      expect(prismaMock.gitAccount.updateMany).toHaveBeenCalledWith({
        where: { id: 'acc-2', userId: 'user-1' },
        data: { isActive: true },
      });
      expect(res.connected).toBe(true);
      expect(res.gitUsername).toBe('work-dev');
    });

    it('should purge all accounts when accountId is omitted', async () => {
      prismaMock.gitAccount.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.disconnect('user-1');

      expect(res.connected).toBe(false);
      expect(prismaMock.gitAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prismaMock.tokenAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'DISCONNECT',
            status: 'SUCCESS',
          }),
        }),
      );
    });
  });

  describe('resolvePullRequest', () => {
    it('rejects malformed PR reference before calling GitHub API', async () => {
      await expect(service.resolvePullRequest('user-1', 'not-a-pr-ref')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('fetches PR metadata and resolves merged state and org ownerType', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        gitUsername: 'thanhba',
        encryptedToken: 'enc',
        tokenIv: 'iv',
        tokenTag: 'tag',
        tokenStatus: 'ACTIVE',
      });

      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockClear();
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            number: 99,
            title: 'feat: cross-repo PR lookup',
            html_url: 'https://github.com/nanocohub/api/pull/99',
            state: 'closed',
            draft: false,
            merged_at: '2026-11-20T09:00:00Z',
            updated_at: '2026-11-20T09:00:00Z',
            head: { ref: 'feat/lookup' },
            base: {
              ref: 'develop',
              repo: {
                full_name: 'nanocohub/api',
                private: true,
                owner: { login: 'nanocohub', type: 'Organization' },
              },
            },
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            {
              sha: 'abc1234567',
              commit: {
                message: 'feat: add lookup endpoint\n\ndetails',
                committer: { date: '2026-11-20T08:50:00Z' },
              },
            },
          ],
        } as unknown as Response);

      const pr = await service.resolvePullRequest(
        'user-1',
        'https://github.com/nanocohub/api/pull/99',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(pr).toEqual(
        expect.objectContaining({
          repo: 'nanocohub/api',
          owner: 'nanocohub',
          ownerType: 'organization',
          number: 99,
          state: 'merged',
          commits: ['feat: add lookup endpoint'],
        }),
      );
    });

    it('throws NotFoundException when GitHub responds 404', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        gitUsername: 'thanhba',
        encryptedToken: 'enc',
        tokenIv: 'iv',
        tokenTag: 'tag',
        tokenStatus: 'ACTIVE',
      });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);

      await expect(service.resolvePullRequest('user-1', 'nanocohub/api#404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('syncPullRequestStates', () => {
    it('batches PR lookups via GraphQL and maps merged/open/draft states', async () => {
      prismaMock.gitAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        gitUsername: 'thanhba',
        encryptedToken: 'enc',
        tokenIv: 'iv',
        tokenTag: 'tag',
        tokenStatus: 'ACTIVE',
      });

      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockClear();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            pr0: {
              pullRequest: {
                title: 'docs(handling): workflow update',
                state: 'CLOSED',
                isDraft: false,
                merged: true,
                mergedAt: '2026-11-25T10:00:00Z',
              },
            },
            pr1: {
              pullRequest: {
                title: 'feat(handling): inline POSTO',
                state: 'OPEN',
                isDraft: false,
                merged: false,
                mergedAt: null,
              },
            },
          },
        }),
      } as unknown as Response);

      const states = await service.syncPullRequestStates('user-1', [
        { repo: 'nanocohub/autopilot-infra', prNumber: 320 },
        { repo: 'nanocohub/supply_chain_system', prNumber: 2698 },
      ]);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(states.get('nanocohub/autopilot-infra#320')).toEqual({
        state: 'merged',
        title: 'docs(handling): workflow update',
      });
      expect(states.get('nanocohub/supply_chain_system#2698')).toEqual({
        state: 'open',
        title: 'feat(handling): inline POSTO',
      });
    });
  });
});
