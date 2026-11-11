import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GitHubService } from "./github.service";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

describe("GitHubService", () => {
  let service: GitHubService;
  let prismaMock: {
    gitAccount: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    tokenAuditLog: {
      create: jest.Mock;
    };
  };
  let cryptoMock: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      gitAccount: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      tokenAuditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    cryptoMock = {
      encrypt: jest.fn().mockReturnValue({
        encryptedText: "enc_text",
        iv: "iv_hex",
        tag: "tag_hex",
        keyVersion: 1,
      }),
      decrypt: jest.fn().mockReturnValue("ghp_decrypted_token"),
    };

    service = new GitHubService(
      prismaMock as unknown as PrismaService,
      cryptoMock as unknown as CryptoService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("savePersonalAccessToken", () => {
    it("should reject empty token", async () => {
      await expect(
        service.savePersonalAccessToken("user-1", "   "),
      ).rejects.toThrow(BadRequestException);
    });

    it("should detect excessive dangerous scopes and record audit log", async () => {
      const mockGhUser = {
        login: "octocat",
        id: 1,
        avatar_url: "https://avatar.url",
        name: "Octocat",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGhUser,
        headers: {
          get: (name: string) => {
            if (name === "x-oauth-scopes")
              return "repo, delete_repo, admin:org";
            if (name === "github-authentication-token-expiration")
              return "2026-12-31 00:00:00 UTC";
            return null;
          },
        },
      } as unknown as Response);

      prismaMock.gitAccount.upsert.mockResolvedValue({
        gitUsername: "octocat",
        gitAvatar: "https://avatar.url",
        authType: "PAT",
        scopes: ["repo", "delete_repo", "admin:org"],
        hasExcessiveScopes: true,
        tokenStatus: "ACTIVE",
        expiresAt: new Date("2026-12-31 00:00:00 UTC"),
      });

      const result = await service.savePersonalAccessToken(
        "user-1",
        "ghp_token_with_admin_scopes",
      );

      expect(result.hasExcessiveScopes).toBe(true);
      expect(result.expiresAt).toBeDefined();
      expect(cryptoMock.encrypt).toHaveBeenCalledWith(
        "ghp_token_with_admin_scopes",
        "user-1",
      );
      expect(prismaMock.tokenAuditLog.create).toHaveBeenCalled();
    });
  });

  describe("getDecryptedToken", () => {
    it("should throw NotFoundException if account not connected", async () => {
      prismaMock.gitAccount.findUnique.mockResolvedValue(null);
      await expect(service.getDecryptedToken("user-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if token is REVOKED", async () => {
      prismaMock.gitAccount.findUnique.mockResolvedValue({
        tokenStatus: "REVOKED",
        encryptedToken: "enc",
        tokenIv: "iv",
        tokenTag: "tag",
      });

      await expect(service.getDecryptedToken("user-1")).rejects.toThrow(
        "GitHub token hiện ở trạng thái REVOKED",
      );
    });

    it("should decrypt successfully using per-user derived key and audit log", async () => {
      prismaMock.gitAccount.findUnique.mockResolvedValue({
        tokenStatus: "ACTIVE",
        encryptedToken: "enc_data",
        tokenIv: "iv_data",
        tokenTag: "tag_data",
        gitUsername: "octocat",
      });

      const res = await service.getDecryptedToken("user-1", "STANDUP_SCAN");

      expect(res.token).toBe("ghp_decrypted_token");
      expect(res.username).toBe("octocat");
      expect(cryptoMock.decrypt).toHaveBeenCalledWith(
        "enc_data",
        "iv_data",
        "tag_data",
        "user-1",
      );
      expect(prismaMock.tokenAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            action: "STANDUP_SCAN",
            status: "SUCCESS",
          }),
        }),
      );
    });
  });

  describe("disconnect", () => {
    it("should purge account and record audit log", async () => {
      prismaMock.gitAccount.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.disconnect("user-1");

      expect(res.success).toBe(true);
      expect(prismaMock.gitAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(prismaMock.tokenAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            action: "DISCONNECT",
            status: "SUCCESS",
          }),
        }),
      );
    });
  });
});
