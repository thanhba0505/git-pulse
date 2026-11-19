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

  it('marks Gemini connection available when model metadata and countTokens succeed', async () => {
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
        new Response(JSON.stringify({ totalTokens: 5 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const result = await aiService.checkAvailability(userId, {
      engine: 'GOOGLE_GEMINI',
      connectionId: 'conn-1',
      model: 'gemini-2.5-flash',
    });

    expect(result.available).toBe(true);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(mockPrisma.aiConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-1', userId },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
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
      prs: [{ repo: 'org/git-pulse', title: 'feat: gemini byok', commits: ['add vault'] }],
    });

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
});
