import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { AiConnection, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { redactTokens } from '../common/token-redactor.util';
import { GitHubService, RequestMetadata } from '../github/github.service';
import {
  CheckAvailabilityDto,
  CreateAiConnectionDto,
  ValidAiEngine,
} from './dto/ai-connection.dto';
import { SummarizeDto } from './dto/summarize.dto';
import {
  AiModelOption,
  buildStandupPrompts,
  DEFAULT_GEMINI_MODELS,
  filterAndSortGeminiModels,
  GEMINI_API_BASE_URL,
  GeminiApiModelEntry,
  GITHUB_MODELS_CATALOG_URL,
  GITHUB_MODELS_INFERENCE_URL,
  isJsonContentType,
  mapGitHubModelId,
  maskApiKey,
  normalizeStoredModels,
  parseStandupBullets,
} from './ai-provider.helpers';

export interface AiConnectionSummary {
  id: string;
  provider: 'GOOGLE_GEMINI';
  label: string;
  maskedKey: string;
  availableModels: AiModelOption[];
  status: string;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiAvailabilityResult {
  available: boolean;
  engine: ValidAiEngine;
  model: string;
  latencyMs: number;
  reasonCode?: string;
  reason?: string;
}

interface GeminiListModelsResponse {
  models?: GeminiApiModelEntry[];
  error?: { message?: string; status?: string };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; status?: string };
}

interface GitHubCatalogModel {
  id?: string;
  name?: string;
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly githubService: GitHubService,
  ) {}

  private toConnectionSummary(conn: AiConnection): AiConnectionSummary {
    const stored = normalizeStoredModels(conn.availableModels);
    return {
      id: conn.id,
      provider: conn.provider,
      label: conn.label,
      maskedKey: conn.maskedKey,
      availableModels: stored.length > 0 ? stored : [...DEFAULT_GEMINI_MODELS],
      status: conn.status,
      lastVerifiedAt: conn.lastVerifiedAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = 8000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async listConnections(userId: string): Promise<AiConnectionSummary[]> {
    const rows = await this.prisma.aiConnection.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toConnectionSummary(row));
  }

  async createConnection(
    userId: string,
    dto: CreateAiConnectionDto,
    defaultLabel: string,
    meta?: RequestMetadata,
  ): Promise<AiConnectionSummary> {
    const cleanKey = dto.apiKey.trim();
    if (!cleanKey) {
      throw new BadRequestException('API Key không được để trống.');
    }

    const label = dto.label?.trim() || defaultLabel.trim() || 'Cá nhân';
    const models = await this.verifyAndFetchGeminiModels(userId, cleanKey, meta);

    const encrypted = this.crypto.encrypt(cleanKey, userId);
    const created = await this.prisma.aiConnection.create({
      data: {
        userId,
        provider: dto.provider,
        label: label.slice(0, 80),
        encryptedKey: encrypted.encryptedText,
        keyIv: encrypted.iv,
        keyTag: encrypted.tag,
        keyVersion: encrypted.keyVersion,
        maskedKey: maskApiKey(cleanKey),
        availableModels: models as unknown as Prisma.InputJsonValue,
        status: 'ACTIVE',
        isActive: true,
        lastVerifiedAt: new Date(),
      },
    });

    await this.githubService.recordAuditLog(
      userId,
      'AI_KEY_SAVE',
      'SUCCESS',
      `Saved ${dto.provider} connection (${created.label})`,
      meta,
    );

    return this.toConnectionSummary(created);
  }

  async updateConnection(
    userId: string,
    connectionId: string,
    dto: CreateAiConnectionDto,
    defaultLabel: string,
    meta?: RequestMetadata,
  ): Promise<AiConnectionSummary> {
    const existing = await this.prisma.aiConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy cấu hình AI cần cập nhật.');
    }

    const cleanKey = dto.apiKey.trim();
    if (!cleanKey) {
      throw new BadRequestException('API Key không được để trống.');
    }

    const label = dto.label?.trim() || existing.label || defaultLabel.trim() || 'Cá nhân';
    const models = await this.verifyAndFetchGeminiModels(userId, cleanKey, meta);
    const encrypted = this.crypto.encrypt(cleanKey, userId);

    const updated = await this.prisma.aiConnection.update({
      where: { id: existing.id },
      data: {
        provider: dto.provider,
        label: label.slice(0, 80),
        encryptedKey: encrypted.encryptedText,
        keyIv: encrypted.iv,
        keyTag: encrypted.tag,
        keyVersion: encrypted.keyVersion,
        maskedKey: maskApiKey(cleanKey),
        availableModels: models as unknown as Prisma.InputJsonValue,
        status: 'ACTIVE',
        isActive: true,
        lastVerifiedAt: new Date(),
      },
    });

    await this.githubService.recordAuditLog(
      userId,
      'AI_KEY_SAVE',
      'SUCCESS',
      `Updated ${dto.provider} connection (${updated.label})`,
      meta,
    );

    return this.toConnectionSummary(updated);
  }

  async deleteConnection(
    userId: string,
    connectionId: string,
    meta?: RequestMetadata,
  ): Promise<{ success: boolean }> {
    const deleted = await this.prisma.aiConnection.deleteMany({
      where: { id: connectionId, userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Không tìm thấy cấu hình AI đã lưu.');
    }

    await this.githubService.recordAuditLog(
      userId,
      'AI_KEY_DELETE',
      'SUCCESS',
      `Deleted AI connection ${connectionId}`,
      meta,
    );

    return { success: true };
  }

  private async verifyAndFetchGeminiModels(
    userId: string,
    apiKey: string,
    meta?: RequestMetadata,
  ): Promise<AiModelOption[]> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${GEMINI_API_BASE_URL}/models?pageSize=100`,
        {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey },
        },
        8000,
      );
    } catch {
      await this.githubService.recordAuditLog(
        userId,
        'AI_KEY_SAVE',
        'FAILED',
        'Network failure contacting Google Gemini API',
        meta,
      );
      throw new BadRequestException('Không thể kết nối tới Google Gemini API. Vui lòng thử lại.');
    }

    const body = (await response.json().catch(() => ({}))) as GeminiListModelsResponse;
    if (!response.ok) {
      const safeErr = redactTokens(body.error?.message || response.statusText);
      await this.githubService.recordAuditLog(
        userId,
        'AI_KEY_SAVE',
        'FAILED',
        `Google Gemini API rejected key (${response.status}): ${safeErr}`,
        meta,
      );
      throw new BadRequestException(
        `API Key Google Gemini không hợp lệ hoặc bị từ chối: ${safeErr}`,
      );
    }

    const filtered = filterAndSortGeminiModels(body.models ?? []);
    return filtered.length > 0 ? filtered : [...DEFAULT_GEMINI_MODELS];
  }

  async checkAvailability(
    userId: string,
    dto: CheckAvailabilityDto,
    meta?: RequestMetadata,
  ): Promise<AiAvailabilityResult> {
    if (dto.engine === 'GOOGLE_GEMINI') {
      return this.checkGeminiAvailability(userId, dto.connectionId, dto.model);
    }
    return this.checkGitHubModelsAvailability(userId, dto.model, meta);
  }

  private async checkGitHubModelsAvailability(
    userId: string,
    model: string,
    meta?: RequestMetadata,
  ): Promise<AiAvailabilityResult> {
    const startedAt = Date.now();
    let token: string;

    try {
      const decrypted = await this.githubService.getDecryptedToken(
        userId,
        'AI_AVAILABILITY_CHECK',
        meta,
      );
      token = decrypted.token;
    } catch {
      return {
        available: false,
        engine: 'GITHUB_MODELS',
        model,
        latencyMs: Date.now() - startedAt,
        reasonCode: 'NO_GITHUB_TOKEN',
        reason: 'Tài khoản chưa có GitHub Token hoạt động để kiểm tra GitHub Models.',
      };
    }

    try {
      const response = await this.fetchWithTimeout(
        GITHUB_MODELS_CATALOG_URL,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'GitPulse-Agent/1.0',
          },
        },
        6000,
      );
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            available: false,
            engine: 'GITHUB_MODELS',
            model,
            latencyMs,
            reasonCode: 'UNAUTHORIZED',
            reason: 'GitHub Token hiện tại không có quyền truy cập GitHub Models.',
          };
        }
        return {
          available: false,
          engine: 'GITHUB_MODELS',
          model,
          latencyMs,
          reasonCode: 'SERVICE_UNAVAILABLE',
          reason: `GitHub Models không khả dụng (HTTP ${response.status}). Hãy thêm Google Gemini để tiếp tục.`,
        };
      }

      if (!isJsonContentType(response.headers.get('content-type'))) {
        return {
          available: false,
          engine: 'GITHUB_MODELS',
          model,
          latencyMs,
          reasonCode: 'SERVICE_UNAVAILABLE',
          reason:
            'GitHub Models API đã ngừng hoạt động hoặc không phản hồi danh mục mô hình. Hãy thêm Google Gemini để sử dụng.',
        };
      }

      const payload = (await response.json().catch(() => null)) as
        GitHubCatalogModel[] | { models?: GitHubCatalogModel[] } | null;
      const list = Array.isArray(payload) ? payload : payload?.models;
      if (!Array.isArray(list)) {
        return {
          available: false,
          engine: 'GITHUB_MODELS',
          model,
          latencyMs,
          reasonCode: 'SERVICE_UNAVAILABLE',
          reason: 'GitHub Models API không khả dụng. Hãy thêm Google Gemini để sử dụng.',
        };
      }

      const normalizedTarget = mapGitHubModelId(model).toLowerCase();
      const matched = list.some((item) => {
        const candidateId = (item.id || item.name || '').toLowerCase();
        return candidateId === normalizedTarget || candidateId === model.trim().toLowerCase();
      });

      if (!matched) {
        return {
          available: false,
          engine: 'GITHUB_MODELS',
          model,
          latencyMs,
          reasonCode: 'MODEL_NOT_FOUND',
          reason: `Mô hình ${model} không còn trong danh mục GitHub Models.`,
        };
      }

      return { available: true, engine: 'GITHUB_MODELS', model, latencyMs };
    } catch {
      return {
        available: false,
        engine: 'GITHUB_MODELS',
        model,
        latencyMs: Date.now() - startedAt,
        reasonCode: 'NETWORK_ERROR',
        reason: 'Không thể kết nối tới GitHub Models API.',
      };
    }
  }

  private async checkGeminiAvailability(
    userId: string,
    connectionId: string | undefined,
    model: string,
  ): Promise<AiAvailabilityResult> {
    const startedAt = Date.now();
    const conn = await this.findGeminiConnection(userId, connectionId);
    if (!conn) {
      return {
        available: false,
        engine: 'GOOGLE_GEMINI',
        model,
        latencyMs: Date.now() - startedAt,
        reasonCode: 'NOT_CONNECTED',
        reason: 'Chưa tìm thấy kết nối Google Gemini. Vui lòng thêm API Key.',
      };
    }

    let apiKey: string;
    try {
      apiKey = this.crypto.decrypt(conn.encryptedKey, conn.keyIv, conn.keyTag, userId);
    } catch {
      return {
        available: false,
        engine: 'GOOGLE_GEMINI',
        model,
        latencyMs: Date.now() - startedAt,
        reasonCode: 'DECRYPT_ERROR',
        reason: 'Không thể giải mã API Key Google Gemini. Vui lòng thêm lại key.',
      };
    }

    const cleanModel = model.trim().replace(/^models\//, '');
    try {
      const metaRes = await this.fetchWithTimeout(
        `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(cleanModel)}`,
        {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey },
        },
        6000,
      );

      if (!metaRes.ok) {
        return this.handleGeminiAvailabilityError(conn.id, cleanModel, metaRes, startedAt);
      }

      const metaBody = (await metaRes.json().catch(() => ({}))) as GeminiApiModelEntry;
      const methods = metaBody.supportedGenerationMethods ?? [];
      if (methods.length > 0 && !methods.includes('generateContent')) {
        return {
          available: false,
          engine: 'GOOGLE_GEMINI',
          model: cleanModel,
          latencyMs: Date.now() - startedAt,
          reasonCode: 'MODEL_UNSUPPORTED',
          reason: `Mô hình ${cleanModel} không hỗ trợ tạo văn bản (generateContent).`,
        };
      }

      // Zero-generation-cost probe to verify runtime access & quota
      const probeRes = await this.fetchWithTimeout(
        `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(cleanModel)}:countTokens`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'standup readiness check' }] }],
          }),
        },
        6000,
      );

      if (!probeRes.ok) {
        return this.handleGeminiAvailabilityError(conn.id, cleanModel, probeRes, startedAt);
      }

      await this.prisma.aiConnection.updateMany({
        where: { id: conn.id, userId },
        data: { status: 'ACTIVE', lastVerifiedAt: new Date() },
      });

      return {
        available: true,
        engine: 'GOOGLE_GEMINI',
        model: cleanModel,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        available: false,
        engine: 'GOOGLE_GEMINI',
        model: cleanModel,
        latencyMs: Date.now() - startedAt,
        reasonCode: 'NETWORK_ERROR',
        reason: 'Không thể kết nối tới Google Gemini API để kiểm tra mô hình.',
      };
    }
  }

  private async handleGeminiAvailabilityError(
    connectionId: string,
    model: string,
    response: Response,
    startedAt: number,
  ): Promise<AiAvailabilityResult> {
    const latencyMs = Date.now() - startedAt;
    const errBody = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
    const rawMsg = redactTokens(errBody.error?.message || response.statusText);

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      await this.prisma.aiConnection.updateMany({
        where: { id: connectionId },
        data: { status: 'REVOKED' },
      });
      return {
        available: false,
        engine: 'GOOGLE_GEMINI',
        model,
        latencyMs,
        reasonCode: 'INVALID_KEY',
        reason: `API Key Google Gemini không hợp lệ hoặc đã bị thu hồi: ${rawMsg}`,
      };
    }

    if (response.status === 404) {
      return {
        available: false,
        engine: 'GOOGLE_GEMINI',
        model,
        latencyMs,
        reasonCode: 'MODEL_NOT_FOUND',
        reason: `Mô hình ${model} không tồn tại hoặc đã ngừng hỗ trợ trên tài khoản này.`,
      };
    }

    if (response.status === 429) {
      return {
        available: false,
        engine: 'GOOGLE_GEMINI',
        model,
        latencyMs,
        reasonCode: 'QUOTA_EXCEEDED',
        reason: 'API Key Google Gemini đã tạm hết hạn mức (429 Rate Limit).',
      };
    }

    return {
      available: false,
      engine: 'GOOGLE_GEMINI',
      model,
      latencyMs,
      reasonCode: 'SERVICE_UNAVAILABLE',
      reason: `Google Gemini trả về lỗi (${response.status}): ${rawMsg}`,
    };
  }

  private async findGeminiConnection(
    userId: string,
    connectionId?: string,
  ): Promise<AiConnection | null> {
    if (connectionId) {
      return this.prisma.aiConnection.findFirst({
        where: { id: connectionId, userId, provider: 'GOOGLE_GEMINI' },
      });
    }
    return this.prisma.aiConnection.findFirst({
      where: { userId, provider: 'GOOGLE_GEMINI' },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async summarize(userId: string, dto: SummarizeDto, meta?: RequestMetadata) {
    if (!dto.prs || dto.prs.length === 0) {
      throw new BadRequestException('Không có Pull Request hoặc Commit nào để tóm tắt.');
    }

    const engine: ValidAiEngine = dto.engine || 'GITHUB_MODELS';
    if (engine === 'GOOGLE_GEMINI') {
      return this.summarizeWithGemini(userId, dto, meta);
    }
    return this.summarizeWithGitHubModels(userId, dto, meta);
  }

  private async summarizeWithGemini(userId: string, dto: SummarizeDto, meta?: RequestMetadata) {
    const conn = await this.findGeminiConnection(userId, dto.connectionId);
    if (!conn) {
      throw new BadRequestException(
        'Chưa kết nối tài khoản Google Gemini. Vui lòng thêm API Key trước.',
      );
    }

    const apiKey = this.crypto.decrypt(conn.encryptedKey, conn.keyIv, conn.keyTag, userId);
    const model = (dto.model || DEFAULT_GEMINI_MODELS[0].id).trim().replace(/^models\//, '');
    const { systemPrompt, userPrompt } = buildStandupPrompts(
      dto.prs,
      dto.language,
      dto.customPrompt,
    );

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 600,
            },
          }),
        },
        20000,
      );
    } catch {
      await this.githubService.recordAuditLog(
        userId,
        'AI_SUMMARIZE',
        'FAILED',
        `Gemini network timeout/error on model ${model}`,
        meta,
      );
      throw new BadRequestException('Không thể kết nối tới Google Gemini API để tạo báo cáo.');
    }

    const data = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
    if (!response.ok) {
      const safeMsg = redactTokens(data.error?.message || response.statusText);
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        await this.prisma.aiConnection.updateMany({
          where: { id: conn.id, userId },
          data: { status: 'REVOKED' },
        });
      }
      await this.githubService.recordAuditLog(
        userId,
        'AI_SUMMARIZE',
        'FAILED',
        `Gemini error (${response.status}): ${safeMsg}`,
        meta,
      );
      throw new BadRequestException(`Lỗi Google Gemini (${model}): ${safeMsg}`);
    }

    const rawContent =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim() || '';

    const bullets = parseStandupBullets(rawContent);
    await this.saveReportAndAudit(userId, dto, 'GOOGLE_GEMINI', model, bullets, meta);

    return {
      success: true,
      bullets,
      rawText: rawContent,
      modelUsed: model,
      engine: 'GOOGLE_GEMINI',
    };
  }

  private async summarizeWithGitHubModels(
    userId: string,
    dto: SummarizeDto,
    meta?: RequestMetadata,
  ) {
    const { token, accountId } = await this.githubService.getDecryptedToken(
      userId,
      'AI_SUMMARIZE',
      meta,
    );
    const rawModel = dto.model || 'openai/gpt-4o-mini';
    const model = mapGitHubModelId(rawModel);
    const { systemPrompt, userPrompt } = buildStandupPrompts(
      dto.prs,
      dto.language,
      dto.customPrompt,
    );

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        GITHUB_MODELS_INFERENCE_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        },
        20000,
      );
    } catch {
      throw new BadRequestException(
        'Không thể kết nối tới GitHub Models API. Vui lòng kiểm tra kết nối hoặc sử dụng Google Gemini.',
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        await this.prisma.gitAccount.updateMany({
          where: { id: accountId, userId },
          data: { tokenStatus: 'REVOKED' },
        });
        throw new BadRequestException(
          'GitHub Token không hợp lệ hoặc đã bị thu hồi khi gọi GitHub Models. Vui lòng kết nối lại.',
        );
      }

      const err = (await response.json().catch(() => ({}))) as { message?: string };
      throw new BadRequestException(
        redactTokens(
          `Lỗi gọi GitHub Models API: ${err.message || response.statusText}. Đảm bảo dịch vụ GitHub Models vẫn khả dụng hoặc thêm Google Gemini.`,
        ),
      );
    }

    if (!isJsonContentType(response.headers.get('content-type'))) {
      throw new BadRequestException(
        'GitHub Models API đã ngừng hoạt động hoặc không trả về JSON. Vui lòng thêm Google Gemini để tạo báo cáo.',
      );
    }

    const data = (await response.json()) as ChatCompletionsResponse;
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
    const bullets = parseStandupBullets(rawContent);

    await this.saveReportAndAudit(userId, dto, 'GITHUB_MODELS', model, bullets, meta);

    return {
      success: true,
      bullets,
      rawText: rawContent,
      modelUsed: model,
      engine: 'GITHUB_MODELS',
    };
  }

  private async saveReportAndAudit(
    userId: string,
    dto: SummarizeDto,
    engine: ValidAiEngine,
    model: string,
    bullets: string[],
    meta?: RequestMetadata,
  ) {
    const totalCommits = dto.prs.reduce((acc, p) => acc + p.commits.length, 0);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    await this.prisma.reportHistory.create({
      data: {
        userId,
        summaryText: bullets.map((b) => `• ${b}`).join('\n'),
        prCount: dto.prs.length,
        commitCount: totalCommits,
        aiEngineUsed: engine,
        modelName: model,
        metadata: JSON.parse(JSON.stringify({ prs: dto.prs })) as Prisma.InputJsonValue,
        dateRangeStart: startOfDay,
        dateRangeEnd: now,
      },
    });

    await this.githubService.recordAuditLog(
      userId,
      'AI_SUMMARIZE',
      'SUCCESS',
      `Synthesized standup via ${engine} (${model})`,
      meta,
    );
  }
}
