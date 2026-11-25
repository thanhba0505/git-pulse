import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParabolClient, ParabolClientError } from './parabol.client';
import { ParabolService } from './parabol.service';

describe('ParabolService', () => {
  const cryptoService = new CryptoService();
  const userId = 'user-parabol-1';
  const rawPat = 'pbl_synthetic_test_token_1234567890abcdef';

  let mockPrisma: {
    parabolConnection: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    tokenAuditLog: {
      create: jest.Mock;
    };
  };

  let mockClient: {
    fetchViewerProfile: jest.Mock;
    fetchActiveStandupMeetings: jest.Mock;
    fetchStandupMeetingById: jest.Mock;
    upsertTeamPromptResponse: jest.Mock;
    shareTeamPromptResponses: jest.Mock;
  };

  let service: ParabolService;

  beforeEach(() => {
    mockPrisma = {
      parabolConnection: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tokenAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    mockClient = {
      fetchViewerProfile: jest.fn(),
      fetchActiveStandupMeetings: jest.fn(),
      fetchStandupMeetingById: jest.fn(),
      upsertTeamPromptResponse: jest.fn(),
      shareTeamPromptResponses: jest.fn(),
    };

    service = new ParabolService(
      mockPrisma as unknown as PrismaService,
      cryptoService,
      mockClient as unknown as ParabolClient,
    );
  });

  it('verifies and encrypts Parabol PAT with HKDF + AES-256-GCM without returning plaintext', async () => {
    mockClient.fetchViewerProfile.mockResolvedValue({
      id: 'p-user-1',
      preferredName: 'Alex Dev',
      email: 'alex@example.com',
      teams: [{ id: 't-1', name: 'Core' }],
    });

    mockPrisma.parabolConnection.upsert.mockImplementation(
      (args: { create: Record<string, unknown> }) => ({
        id: 'conn-1',
        ...args.create,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await service.saveConnection(userId, { token: rawPat, label: 'Work' });

    expect(summary.parabolUserId).toBe('p-user-1');
    expect(summary.maskedPrefix).toBe('pbl_••••cdef');
    expect(JSON.stringify(summary)).not.toContain(rawPat);

    const upsertCall = mockPrisma.parabolConnection.upsert.mock.calls[0]?.[0] as {
      create: { encryptedToken: string; tokenIv: string; tokenTag: string };
    };
    const decrypted = cryptoService.decrypt(
      upsertCall.create.encryptedToken,
      upsertCall.create.tokenIv,
      upsertCall.create.tokenTag,
      userId,
    );
    expect(decrypted).toBe(rawPat);
    expect(mockPrisma.tokenAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          action: 'PARABOL_PAT_SAVE',
          status: 'SUCCESS',
        }),
      }),
    );
  });

  it('submits standup as Private Draft by default without calling shareTeamPromptResponses', async () => {
    const encrypted = cryptoService.encrypt(rawPat, userId);
    mockPrisma.parabolConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId,
      label: 'Work',
      parabolUserId: 'p-user-1',
      parabolName: 'Alex Dev',
      parabolEmail: 'alex@example.com',
      encryptedToken: encrypted.encryptedText,
      tokenIv: encrypted.iv,
      tokenTag: encrypted.tag,
      keyVersion: 1,
      maskedPrefix: 'pbl_••••cdef',
      baseUrl: 'https://action.parabol.co',
      status: 'ACTIVE',
      isActive: true,
    });
    mockPrisma.parabolConnection.update.mockResolvedValue({});

    mockClient.upsertTeamPromptResponse.mockResolvedValue({
      responseId: 'resp-1',
      promptId: 'prompt-1',
      sharedAt: null,
      meetingId: 'm-123',
      meetingName: 'Daily Standup',
    });

    const result = await service.submitStandup(userId, {
      meetingId: 'https://action.parabol.co/meet/m-123',
      promptId: 'prompt-1',
      bullets: ['Shipped Parabol integration'],
      shareImmediately: false,
    });

    expect(result.shared).toBe(false);
    expect(result.meetingUrl).toBe('https://action.parabol.co/meet/m-123');
    expect(mockClient.upsertTeamPromptResponse).toHaveBeenCalledTimes(1);
    expect(mockClient.shareTeamPromptResponses).not.toHaveBeenCalled();
  });

  it('calls shareTeamPromptResponses when shareImmediately is true and revokes token on 401', async () => {
    const encrypted = cryptoService.encrypt(rawPat, userId);
    const storedConn = {
      id: 'conn-1',
      userId,
      label: 'Work',
      parabolUserId: 'p-user-1',
      parabolName: 'Alex Dev',
      parabolEmail: 'alex@example.com',
      encryptedToken: encrypted.encryptedText,
      tokenIv: encrypted.iv,
      tokenTag: encrypted.tag,
      keyVersion: 1,
      maskedPrefix: 'pbl_••••cdef',
      baseUrl: 'https://action.parabol.co',
      status: 'ACTIVE',
      isActive: true,
    };
    mockPrisma.parabolConnection.findFirst.mockResolvedValue(storedConn);
    mockPrisma.parabolConnection.update.mockResolvedValue({});

    mockClient.upsertTeamPromptResponse.mockResolvedValue({
      responseId: 'resp-2',
      promptId: 'prompt-1',
      sharedAt: null,
      meetingId: 'm-123',
      meetingName: 'Daily Standup',
    });
    mockClient.shareTeamPromptResponses.mockResolvedValue({
      meetingId: 'm-123',
      sharedCount: 1,
      sharedAt: '2026-11-25T10:30:00.000Z',
    });

    const sharedResult = await service.submitStandup(userId, {
      meetingId: 'm-123',
      promptId: 'prompt-1',
      bullets: ['Added tests'],
      shareImmediately: true,
    });

    expect(sharedResult.shared).toBe(true);
    expect(mockClient.shareTeamPromptResponses).toHaveBeenCalledWith(rawPat, 'm-123');

    mockClient.upsertTeamPromptResponse.mockRejectedValue(
      new ParabolClientError({
        statusCode: 401,
        code: 'PARABOL_AUTH_FAILED',
        message: 'Unauthorized',
        revokeToken: true,
      }),
    );

    await expect(
      service.submitStandup(userId, {
        meetingId: 'm-123',
        promptId: 'prompt-1',
        bullets: ['Retry'],
      }),
    ).rejects.toThrow(ParabolClientError);

    expect(mockPrisma.parabolConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'REVOKED' },
    });
  });

  it('switches active Parabol connection and clears standup cache', async () => {
    mockPrisma.parabolConnection.findFirst.mockResolvedValue({
      id: 'conn-2',
      userId,
      label: 'Personal',
      parabolName: 'Ba Ba',
    });
    mockPrisma.parabolConnection.update.mockResolvedValue({ id: 'conn-2', isActive: true });
    mockPrisma.parabolConnection.findMany.mockResolvedValue([
      { id: 'conn-2', label: 'Personal', isActive: true, status: 'ACTIVE' },
      { id: 'conn-1', label: 'Work', isActive: false, status: 'ACTIVE' },
    ]);

    const list = await service.switchActiveConnection(userId, 'conn-2');

    expect(mockPrisma.parabolConnection.updateMany).toHaveBeenCalledWith({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    expect(mockPrisma.parabolConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-2' },
      data: { isActive: true },
    });
    expect(list).toHaveLength(2);
    expect(list[0]?.isActive).toBe(true);
  });

  it('verifies unsaved Parabol PAT and returns suggested profile label without saving', async () => {
    mockClient.fetchViewerProfile.mockResolvedValue({
      id: 'p-user-1',
      preferredName: 'Alex Dev',
      email: 'alex@example.com',
      teams: [{ id: 't-1', name: 'Core' }],
    });

    const result = await service.verifyToken(userId, { token: rawPat });

    expect(result.valid).toBe(true);
    expect(result.suggestedLabel).toBe('Alex Dev');
    expect(result.email).toBe('alex@example.com');
    expect(result.maskedPrefix).toBe('pbl_••••cdef');
    expect(result.expiresAt).toBeNull();
    expect(mockPrisma.parabolConnection.upsert).not.toHaveBeenCalled();
  });
});
