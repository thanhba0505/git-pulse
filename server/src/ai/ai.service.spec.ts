import { BadRequestException } from '@nestjs/common';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubService } from '../github/github.service';
import { AiService } from './ai.service';

describe('AiService', () => {
  const cryptoService = new CryptoService();
  const userId = 'user-123';
  const syntheticGeminiKey = 'AIza' + 'SyTestGeminiKey1234567890abcdefghijk';

  let mockPrisma: {
    aiConnection: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    gitAccount: { updateMany: jest.Mock };
    reportHistory: { create: jest.Mock };
  };
  let mockGithubService: {
    recordAuditLog: jest.Mock;
    getDecryptedToken: jest.Mock;
  };
  let aiService: AiService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPrisma = {
      aiConnection: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
      },
      gitAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      reportHistory: {
        create: jest.fn().mockResolvedValue({ id: 'report-1' }),
      },
    };
    mockGithubService = {
      recordAuditLog: jest.fn().mockResolvedValue(undefined),
      getDecryptedToken: jest.fn().mockResolvedValue({
        token: 'ghp_1234567890abcdef1234567890abcdef1234',
        username: 'devuser',
        accountId: 'acc-1',
      }),
    };

    aiService = new AiService(
      mockPrisma as unknown as PrismaService,
      cryptoService,
      mockGithubService as unknown as GitHubService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('verifies Gemini key, encrypts it per-user, and returns masked summary without plaintext', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent', 'countTokens'],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    mockPrisma.aiConnection.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'conn-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await aiService.createConnection(
      userId,
      { provider: 'GOOGLE_GEMINI', apiKey: syntheticGeminiKey, label: '' },
      'lethanhba',
    );

    const createCall = mockPrisma.aiConnection.create.mock.calls[0][0] as {
      data: { encryptedKey: string; keyIv: string; keyTag: string; label: string };
    };
    expect(createCall.data.encryptedKey).not.toBe(syntheticGeminiKey);
    expect(createCall.data.label).toBe('lethanhba');
    expect(
      cryptoService.decrypt(
        createCall.data.encryptedKey,
        createCall.data.keyIv,
        createCall.data.keyTag,
        userId,
      ),
    ).toBe(syntheticGeminiKey);

    expect(summary.label).toBe('lethanhba');
    expect(summary.maskedKey).toBe('AIza••••hijk');
    expect(summary.availableModels.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    expect(JSON.stringify(summary)).not.toContain(syntheticGeminiKey);
  });

  it('rejects invalid Gemini key without leaking secret in error or audit log', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: `API key not valid: ${syntheticGeminiKey}` },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      aiService.createConnection(
        userId,
        { provider: 'GOOGLE_GEMINI', apiKey: syntheticGeminiKey },
        'lethanhba',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.aiConnection.create).not.toHaveBeenCalled();
    const auditDetails = mockGithubService.recordAuditLog.mock.calls[0][3] as string;
    expect(auditDetails).not.toContain(syntheticGeminiKey);
    expect(auditDetails).toContain('[REDACTED_AI_KEY]');
  });

  it('detects retired GitHub Models non-JSON OK response during availability check', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('OK', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );

    const result = await aiService.checkAvailability(userId, {
      engine: 'GITHUB_MODELS',
      model: 'openai/gpt-4o-mini',
    });

    expect(result.available).toBe(false);
    expect(result.reasonCode).toBe('SERVICE_UNAVAILABLE');
  });

  it('marks Gemini connection available when model metadata and 1-token generateContent probe succeed', async () => {
    const encrypted = cryptoService.encrypt(syntheticGeminiKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      provider: 'GOOGLE_GEMINI',
      label: 'lethanhba',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'AIza••••hijk',
      status: 'ACTIVE',
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'models/gemini-2.5-flash',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ finishReason: 'MAX_TOKENS' }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    const result = await aiService.checkAvailability(userId, {
      engine: 'GOOGLE_GEMINI',
      connectionId: 'conn-1',
      model: 'gemini-2.5-flash',
    });

    expect(result.available).toBe(true);
    expect(result.model).toBe('gemini-2.5-flash');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(':generateContent');
    expect(mockPrisma.aiConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-1', userId },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('flags Free Tier limit:0 quota models unavailable without revoking the Gemini key', async () => {
    const encrypted = cryptoService.encrypt(syntheticGeminiKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      provider: 'GOOGLE_GEMINI',
      label: 'lethanhba',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'AIza••••hijk',
      status: 'ACTIVE',
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'models/gemini-4-argon',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message:
                'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-4-argon',
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
      );

    const result = await aiService.checkAvailability(userId, {
      engine: 'GOOGLE_GEMINI',
      connectionId: 'conn-1',
      model: 'gemini-4-argon',
    });

    expect(result.available).toBe(false);
    expect(result.reasonCode).toBe('QUOTA_EXCEEDED');
    expect(result.reason).toContain('limit = 0');
    expect(mockPrisma.aiConnection.updateMany).not.toHaveBeenCalled();
  });

  it('surfaces timeout classification cleanly when Gemini probe or summarize aborts', async () => {
    const encrypted = cryptoService.encrypt(syntheticGeminiKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      provider: 'GOOGLE_GEMINI',
      label: 'lethanhba',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'AIza••••hijk',
      status: 'ACTIVE',
    });

    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'models/gemini-3.5-flash',
            supportedGenerationMethods: ['generateContent'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockRejectedValueOnce(abortErr);

    const avail = await aiService.checkAvailability(userId, {
      engine: 'GOOGLE_GEMINI',
      connectionId: 'conn-1',
      model: 'gemini-3.5-flash',
    });
    expect(avail.available).toBe(false);
    expect(avail.reasonCode).toBe('TIMEOUT');

    global.fetch = jest.fn().mockRejectedValueOnce(abortErr);
    await expect(
      aiService.summarize(userId, {
        engine: 'GOOGLE_GEMINI',
        connectionId: 'conn-1',
        model: 'gemini-3.5-flash',
        prs: [{ repo: 'org/repo', title: 'feat: test', commits: ['c1'] }],
      }),
    ).rejects.toThrow(/quá thời gian chờ/i);
  });

  it('summarizes PRs with Google Gemini and persists ReportHistory', async () => {
    const encrypted = cryptoService.encrypt(syntheticGeminiKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      provider: 'GOOGLE_GEMINI',
      label: 'lethanhba',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'AIza••••hijk',
      status: 'ACTIVE',
    });

    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '• Added Gemini BYOK vault\n• Verified model availability check' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const res = await aiService.summarize(userId, {
      engine: 'GOOGLE_GEMINI',
      connectionId: 'conn-1',
      model: 'gemini-2.5-flash',
      language: 'en',
      customPrompt: 'Group work clearly by module.',
      prs: [{ repo: 'org/git-pulse', title: 'PR TITLE MUST BE IGNORED', commits: ['add vault'] }],
    });

    const sentPayload = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit).body as string,
    ) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(sentPayload.systemInstruction.parts[0].text).toContain('Group work clearly by module.');
    expect(sentPayload.contents[0].parts[0].text).toContain('add vault');
    expect(sentPayload.contents[0].parts[0].text).not.toContain('PR TITLE MUST BE IGNORED');

    expect(res.engine).toBe('GOOGLE_GEMINI');
    expect(res.bullets).toEqual(['Added Gemini BYOK vault', 'Verified model availability check']);
    expect(mockPrisma.reportHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiEngineUsed: 'GOOGLE_GEMINI',
          modelName: 'gemini-2.5-flash',
        }),
      }),
    );
  });

  it('rejects summarization when selected items contain zero commits', async () => {
    await expect(
      aiService.summarize(userId, {
        engine: 'GOOGLE_GEMINI',
        prs: [{ repo: 'org/git-pulse', title: 'Empty PR', commits: ['   '] }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('previews live models from an unsaved Gemini key without storing it', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const preview = await aiService.previewModels(userId, {
      provider: 'GOOGLE_GEMINI',
      apiKey: syntheticGeminiKey,
    });

    expect(preview.valid).toBe(true);
    expect(preview.maskedKey).toBe('AIza••••hijk');
    expect(preview.models.map((m) => m.id)).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
    expect(mockPrisma.aiConnection.create).not.toHaveBeenCalled();
  });

  it('refreshes live models from a saved Gemini connection and updates database', async () => {
    const encrypted = cryptoService.encrypt(syntheticGeminiKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      provider: 'GOOGLE_GEMINI',
      label: 'lethanhba',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'AIza••••hijk',
      status: 'ACTIVE',
    });
    mockPrisma.aiConnection.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'conn-1',
        userId,
        provider: 'GOOGLE_GEMINI',
        label: 'lethanhba',
        maskedKey: 'AIza••••hijk',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-3.8-flash',
              displayName: 'Gemini 3.8 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const refreshed = await aiService.refreshConnectionModels(userId, 'conn-1');
    expect(refreshed.availableModels.map((m) => m.id)).toEqual(['gemini-3.8-flash']);
    expect(mockPrisma.aiConnection.update).toHaveBeenCalled();
  });

  it('returns live GitHub catalog models when catalog endpoint returns valid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'openai/gpt-4o-mini',
            friendly_name: 'GPT-4o mini',
            publisher: 'OpenAI',
            task: 'chat-completion',
            supported_output_modalities: ['text'],
          },
          {
            id: 'deepseek/deepseek-r1',
            friendly_name: 'DeepSeek R1',
            publisher: 'DeepSeek',
            task: 'chat-completion',
            supported_output_modalities: ['text'],
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await aiService.checkAvailability(userId, {
      engine: 'GITHUB_MODELS',
      model: 'openai/gpt-4o-mini',
    });

    expect(result.available).toBe(true);
    expect(result.availableModels?.map((m) => m.id)).toEqual([
      'openai/gpt-4o-mini',
      'deepseek/deepseek-r1',
    ]);
  });

  it('creates a Groq connection, verifies key against Groq models endpoint, and saves encrypted key', async () => {
    const syntheticGroqKey = 'gsk_test1234567890abcdef1234567890';
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'llama-3.3-70b-versatile', active: true },
            { id: 'deepseek-r1-distill-llama-70b', active: true },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    mockPrisma.aiConnection.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'conn-groq-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await aiService.createConnection(
      userId,
      { provider: 'GROQ', apiKey: syntheticGroqKey, label: 'My Groq' },
      'lethanhba',
    );

    expect(summary.provider).toBe('GROQ');
    expect(summary.label).toBe('My Groq');
    expect(summary.maskedKey).toBe('gsk_••••7890');
    expect(summary.availableModels.map((m) => m.id)).toEqual([
      'llama-3.3-70b-versatile',
      'deepseek-r1-distill-llama-70b',
    ]);
  });

  it('checks availability for Groq connection and succeeds when probe completions call returns 200', async () => {
    const syntheticGroqKey = 'gsk_test1234567890abcdef1234567890';
    const encrypted = cryptoService.encrypt(syntheticGroqKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-groq-1',
      userId,
      provider: 'GROQ',
      label: 'My Groq',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'gsk_••••7890',
      status: 'ACTIVE',
    });

    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Pong' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await aiService.checkAvailability(userId, {
      engine: 'GROQ',
      connectionId: 'conn-groq-1',
      model: 'llama-3.3-70b-versatile',
    });

    expect(result.available).toBe(true);
    expect(result.engine).toBe('GROQ');
    expect(result.model).toBe('llama-3.3-70b-versatile');
  });

  it('summarizes activities with Groq using OpenAI-compatible chat completions', async () => {
    const syntheticGroqKey = 'gsk_test1234567890abcdef1234567890';
    const encrypted = cryptoService.encrypt(syntheticGroqKey, userId);
    mockPrisma.aiConnection.findFirst.mockResolvedValue({
      id: 'conn-groq-1',
      userId,
      provider: 'GROQ',
      label: 'My Groq',
      encryptedKey: encrypted.encryptedText,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keyVersion: encrypted.keyVersion,
      maskedKey: 'gsk_••••7890',
      status: 'ACTIVE',
    });

    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '- Tích hợp Groq Cloud provider\n- Tối ưu hóa hiệu năng tổng hợp',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await aiService.summarize(userId, {
      engine: 'GROQ',
      connectionId: 'conn-groq-1',
      model: 'llama-3.3-70b-versatile',
      prs: [
        {
          repo: 'prism-hub',
          title: 'Add Groq support',
          commits: ['feat(ai): integrate groq provider'],
        },
      ],
    });

    expect(result.bullets).toEqual([
      'Tích hợp Groq Cloud provider',
      'Tối ưu hóa hiệu năng tổng hợp',
    ]);
    expect(result.engine).toBe('GROQ');
  });
});
