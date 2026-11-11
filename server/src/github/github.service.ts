import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../common/crypto.service";

export interface GitHubUserResponse {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
}

export interface CommitItem {
  sha: string;
  message: string;
  date: string;
}

export interface PrActivity {
  repo: string;
  number: number;
  title: string;
  prUrl: string;
  state: string;
  commits: string[];
  commitDetails: CommitItem[];
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async savePersonalAccessToken(userId: string, token: string) {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new BadRequestException("Token không được để trống.");
    }

    // Verify token with GitHub API
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitPulse-Agent/1.0",
      },
    });

    if (!userRes.ok) {
      const err = await userRes.json().catch(() => ({}));
      throw new BadRequestException(
        `Xác thực Personal Access Token thất bại: ${err.message || userRes.statusText}`,
      );
    }

    const ghUser = (await userRes.json()) as GitHubUserResponse;
    const scopesHeader = userRes.headers.get("x-oauth-scopes") || "";
    const scopes = scopesHeader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const encrypted = this.crypto.encrypt(cleanToken);

    const account = await this.prisma.gitAccount.upsert({
      where: { userId },
      update: {
        authType: "PAT",
        encryptedToken: encrypted.encryptedText,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        gitUsername: ghUser.login,
        gitId: String(ghUser.id),
        gitAvatar: ghUser.avatar_url,
        scopes,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        authType: "PAT",
        encryptedToken: encrypted.encryptedText,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        gitUsername: ghUser.login,
        gitId: String(ghUser.id),
        gitAvatar: ghUser.avatar_url,
        scopes,
        lastSyncAt: new Date(),
      },
    });

    return {
      success: true,
      username: account.gitUsername,
      avatarUrl: account.gitAvatar,
      authType: account.authType,
      scopes: account.scopes,
    };
  }

  async exchangeOAuthCode(userId: string, code: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "GitHub OAuth chưa được cấu hình Client ID & Secret trên server. Bạn có thể sử dụng Personal Access Token (PAT) ngay.",
      );
    }

    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      throw new BadRequestException(
        `Trao đổi OAuth code thất bại: ${tokenData.error || "Token không hợp lệ"}`,
      );
    }

    return this.savePersonalAccessToken(userId, tokenData.access_token);
  }

  async getStatus(userId: string) {
    const account = await this.prisma.gitAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { connected: false };
    }

    return {
      connected: true,
      gitUsername: account.gitUsername,
      gitAvatar: account.gitAvatar,
      authType: account.authType,
      scopes: account.scopes,
      lastSyncAt: account.lastSyncAt,
    };
  }

  async disconnect(userId: string) {
    await this.prisma.gitAccount.deleteMany({
      where: { userId },
    });
    return { success: true };
  }

  async getDecryptedToken(
    userId: string,
  ): Promise<{ token: string; username: string }> {
    const account = await this.prisma.gitAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException("Tài khoản chưa được kết nối với GitHub.");
    }

    const token = this.crypto.decrypt(
      account.encryptedToken,
      account.tokenIv,
      account.tokenTag,
    );

    return { token, username: account.gitUsername };
  }

  async fetchActivity(
    userId: string,
    sinceIso?: string,
  ): Promise<PrActivity[]> {
    const { token, username } = await this.getDecryptedToken(userId);

    // Calculate beginning of today in UTC if not provided
    let since: Date;
    if (sinceIso) {
      since = new Date(sinceIso);
    } else {
      since = new Date();
      since.setHours(0, 0, 0, 0);
    }

    const sinceDateStr = since.toISOString().slice(0, 10);
    const searchUrl = `https://api.github.com/search/issues?q=is:pr+author:${username}+updated:>=${sinceDateStr}&sort=updated&order=desc&per_page=50`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitPulse-Agent/1.0",
    };

    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      throw new BadRequestException(
        `Lỗi khi truy vấn PR từ GitHub: ${err.message || searchRes.statusText}`,
      );
    }

    const searchData = (await searchRes.json()) as {
      items?: Array<{
        number: number;
        title: string;
        html_url: string;
        state: string;
        repository_url: string;
        updated_at: string;
      }>;
    };

    const items = searchData.items || [];
    const activities: PrActivity[] = [];

    for (const pr of items) {
      const repoFullName = pr.repository_url.replace(
        "https://api.github.com/repos/",
        "",
      );
      const commitsUrl = `https://api.github.com/repos/${repoFullName}/pulls/${pr.number}/commits?per_page=100`;

      try {
        const commitsRes = await fetch(commitsUrl, { headers });
        if (commitsRes.ok) {
          const commitsJson = (await commitsRes.json()) as Array<{
            sha: string;
            commit: {
              message: string;
              committer: { date: string };
            };
          }>;

          const recentCommits: CommitItem[] = [];
          const commitHeadlines: string[] = [];

          for (const c of commitsJson) {
            const commitDate = new Date(c.commit.committer.date);
            if (commitDate >= since) {
              const headline = c.commit.message.split("\n")[0].trim();
              commitHeadlines.push(headline);
              recentCommits.push({
                sha: c.sha.slice(0, 7),
                message: headline,
                date: c.commit.committer.date,
              });
            }
          }

          if (recentCommits.length > 0) {
            activities.push({
              repo: repoFullName,
              number: pr.number,
              title: pr.title,
              prUrl: pr.html_url,
              state: pr.state,
              commits: commitHeadlines,
              commitDetails: recentCommits,
            });
          }
        }
      } catch (err) {
        this.logger.warn(
          `Could not fetch commits for ${repoFullName}#${pr.number}: ${(err as Error).message}`,
        );
      }
    }

    // Update last sync
    await this.prisma.gitAccount.updateMany({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    return activities;
  }
}
