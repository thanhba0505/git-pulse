import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GitHubService } from "../github/github.service";
import { SummarizeDto } from "./dto/summarize.dto";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly githubModelsEndpoint =
    "https://models.inference.ai.azure.com/chat/completions";

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
  ) {}

  async summarizeWithGitHubModels(userId: string, dto: SummarizeDto) {
    if (!dto.prs || dto.prs.length === 0) {
      throw new BadRequestException(
        "Không có Pull Request hoặc Commit nào để tóm tắt.",
      );
    }

    const { token } = await this.githubService.getDecryptedToken(
      userId,
      "AI_SUMMARIZE",
    );
    const model = dto.model || "gpt-4o-mini";
    const lang = dto.language === "en" ? "English" : "Vietnamese";

    // Format input data
    const prDetails = dto.prs
      .map(
        (p) =>
          `Repository: ${p.repo}\nPR Title: ${p.title}\nCommits:\n` +
          p.commits.map((c) => `  - ${c}`).join("\n"),
      )
      .join("\n\n");

    const defaultSystemPrompt =
      dto.customPrompt ||
      `You are an expert tech lead summarizing daily developer progress for standup. ` +
        `Summarize the provided pull requests and commit titles into 3 to 4 concise bullet points in ${lang}. ` +
        `Group related work, emphasize actual features, bugfixes and outcomes, skip trivial docs or merge noise. ` +
        `Each bullet point MUST start with "• " or "- ", be under 20 words, and use clean, natural developer terminology without AI clichés. ` +
        `Return ONLY the bullet points, no preamble, title, or greeting.`;

    const userPrompt = `Pull Requests and Commits worked on today:\n\n${prDetails}`;

    const response = await fetch(this.githubModelsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: defaultSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.prisma.gitAccount.updateMany({
          where: { userId },
          data: { tokenStatus: "REVOKED" },
        });
        throw new BadRequestException(
          "GitHub Token không hợp lệ hoặc đã bị thu hồi khi gọi GitHub Models. Vui lòng kết nối lại.",
        );
      }

      const err = await response.json().catch(() => ({}));
      throw new BadRequestException(
        `Lỗi gọi GitHub Models API: ${err.message || response.statusText}. Đảm bảo token GitHub của bạn có quyền truy cập GitHub Models.`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawContent = data.choices?.[0]?.message?.content?.trim() || "";
    const lines = rawContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^[-*•]\s*/, ""));

    const bullets =
      lines.length > 0 ? lines : ["Cập nhật và tối ưu hóa hệ thống."];

    // Total count of commits
    const totalCommits = dto.prs.reduce((acc, p) => acc + p.commits.length, 0);

    // Save to database ReportHistory
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    await this.prisma.reportHistory.create({
      data: {
        userId,
        summaryText: bullets.map((b) => `• ${b}`).join("\n"),
        prCount: dto.prs.length,
        commitCount: totalCommits,
        aiEngineUsed: "GITHUB_MODELS",
        modelName: model,
        metadata: JSON.parse(
          JSON.stringify({ prs: dto.prs }),
        ) as Prisma.InputJsonValue,
        dateRangeStart: startOfDay,
        dateRangeEnd: now,
      },
    });

    return {
      success: true,
      bullets,
      rawText: rawContent,
      modelUsed: model,
      engine: "GITHUB_MODELS",
    };
  }

  async saveClientSummary(
    userId: string,
    body: {
      summary: string[];
      modelName: string;
      prCount: number;
      commitCount: number;
      engine: "WEB_LLM";
      metadata?: Record<string, unknown>;
    },
  ) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.reportHistory.create({
      data: {
        userId,
        summaryText: body.summary
          .map((b) => `• ${b.replace(/^[-*•]\s*/, "")}`)
          .join("\n"),
        prCount: body.prCount,
        commitCount: body.commitCount,
        aiEngineUsed: body.engine,
        modelName: body.modelName,
        metadata: body.metadata
          ? (JSON.parse(JSON.stringify(body.metadata)) as Prisma.InputJsonValue)
          : undefined,
        dateRangeStart: startOfDay,
        dateRangeEnd: now,
      },
    });
  }
}
