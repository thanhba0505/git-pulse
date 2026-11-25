import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParabolConnection } from '@prisma/client';
import { CryptoService } from '../common/crypto.service';
import { redactTokens } from '../common/token-redactor.util';
import { RequestMetadata } from '../github/github.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateParabolConnectionDto,
  SubmitParabolStandupDto,
  VerifyParabolTokenDto,
} from './dto/parabol.dto';
import { ParabolClient, ParabolClientError, ParabolStandupMeeting } from './parabol.client';
import {
  buildParabolMeetingUrl,
  buildParabolTipTapContent,
  maskParabolToken,
  normalizeParabolToken,
  parseParabolMeetingId,
  resolveParabolBaseUrl,
} from './parabol.helpers';

export interface ParabolConnectionSummary {
  id: string;
  label: string;
  parabolUserId: string;
  parabolName: string | null;
  parabolEmail: string | null;
  maskedPrefix: string;
  status: string;
  isActive: boolean;
  expiresAt: Date | null;
  lastVerifiedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerifyParabolTokenResult {
  valid: boolean;
  suggestedLabel: string;
  name: string | null;
  email: string | null;
  maskedPrefix: string;
  expiresAt: string | null;
  teams: Array<{ id: string; name: string }>;
}

export interface ListParabolStandupsResult {
  connected: boolean;
  connection: ParabolConnectionSummary | null;
  meetings: ParabolStandupMeeting[];
}

export interface SubmitParabolStandupResult {
  success: boolean;
  responseId: string;
  meetingId: string;
  meetingName: string;
  meetingUrl: string;
  promptId: string;
  shared: boolean;
  sharedAt: string | null;
}

const STANDUP_CACHE_TTL_MS = 30_000;

@Injectable()
export class ParabolService {
  private readonly logger = new Logger(ParabolService.name);
  private readonly standupsCache = new Map<
    string,
    { expiresAt: number; meetings: ParabolStandupMeeting[] }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly parabolClient: ParabolClient,
  ) {}

  private toSummary(conn: ParabolConnection): ParabolConnectionSummary {
    return {
      id: conn.id,
      label: conn.label,
      parabolUserId: conn.parabolUserId,
      parabolName: conn.parabolName,
      parabolEmail: conn.parabolEmail,
      maskedPrefix: conn.maskedPrefix,
      status: conn.status,
      isActive: conn.isActive,
      expiresAt: conn.expiresAt,
      lastVerifiedAt: conn.lastVerifiedAt,
      lastUsedAt: conn.lastUsedAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  private async logAudit(
    userId: string,
    action: string,
    status: 'SUCCESS' | 'FAILED',
    meta?: RequestMetadata,
    details?: string,
  ): Promise<void> {
    await this.prisma.tokenAuditLog.create({
      data: {
        userId,
        action,
        status,
        ipAddress: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        details: details ? redactTokens(details).slice(0, 500) : null,
      },
    });
  }

  private async resolveActiveConnection(
    userId: string,
    connectionId?: string,
  ): Promise<ParabolConnection> {
    if (connectionId) {
      const conn = await this.prisma.parabolConnection.findFirst({
        where: { id: connectionId, userId },
      });
      if (!conn) {
        throw new NotFoundException('Parabol connection not found.');
      }
      return conn;
    }

    const active = await this.prisma.parabolConnection.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!active) {
      throw new NotFoundException(
        'No active Parabol connection found. Please connect your Parabol Personal Access Token in Settings.',
      );
    }

    return active;
  }

  private decryptConnectionToken(conn: ParabolConnection): string {
    return this.crypto.decrypt(conn.encryptedToken, conn.tokenIv, conn.tokenTag, conn.userId);
  }

  private async handleClientError(
    conn: ParabolConnection,
    error: unknown,
    auditAction: string,
    meta?: RequestMetadata,
  ): Promise<never> {
    if (error instanceof ParabolClientError && error.revokeToken) {
      await this.prisma.parabolConnection.update({
        where: { id: conn.id },
        data: { status: 'REVOKED' },
      });
    }

    const detail = error instanceof Error ? error.message : 'Unknown Parabol API error';
    await this.logAudit(conn.userId, auditAction, 'FAILED', meta, detail);
    this.logger.warn(
      `Parabol ${auditAction} failed for user ${conn.userId}: ${redactTokens(detail)}`,
    );
    throw error;
  }

  async listConnections(userId: string): Promise<ParabolConnectionSummary[]> {
    const connections = await this.prisma.parabolConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return connections.map((conn) => this.toSummary(conn));
  }

  async verifyToken(
    userId: string,
    dto: VerifyParabolTokenDto,
    meta?: RequestMetadata,
  ): Promise<VerifyParabolTokenResult> {
    const token = normalizeParabolToken(dto.token);
    if (!token) {
      throw new BadRequestException('Parabol Personal Access Token is required.');
    }

    try {
      const profile = await this.parabolClient.fetchViewerProfile(token);
      await this.logAudit(
        userId,
        'PARABOL_PAT_VERIFY',
        'SUCCESS',
        meta,
        `Verified Parabol account ${profile.preferredName}`,
      );

      return {
        valid: true,
        suggestedLabel: profile.preferredName || profile.email || 'Parabol',
        name: profile.preferredName || null,
        email: profile.email,
        maskedPrefix: maskParabolToken(token),
        expiresAt: profile.expiresAt ? profile.expiresAt.toISOString() : null,
        teams: profile.teams,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Token verification failed';
      await this.logAudit(userId, 'PARABOL_PAT_VERIFY', 'FAILED', meta, detail);
      throw error;
    }
  }

  async saveConnection(
    userId: string,
    dto: CreateParabolConnectionDto,
    meta?: RequestMetadata,
  ): Promise<ParabolConnectionSummary> {
    const token = normalizeParabolToken(dto.token);
    if (!token) {
      throw new BadRequestException('Parabol Personal Access Token is required.');
    }

    let profile;
    try {
      profile = await this.parabolClient.fetchViewerProfile(token);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Token verification failed';
      await this.logAudit(userId, 'PARABOL_PAT_SAVE', 'FAILED', meta, detail);
      throw error;
    }

    const encrypted = this.crypto.encrypt(token, userId);
    const maskedPrefix = maskParabolToken(token);
    const label = dto.label?.trim() || profile.preferredName || profile.email || 'Parabol';
    const baseUrl = resolveParabolBaseUrl();

    await this.prisma.parabolConnection.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const saved = await this.prisma.parabolConnection.upsert({
      where: {
        userId_parabolUserId: {
          userId,
          parabolUserId: profile.id,
        },
      },
      create: {
        userId,
        label,
        parabolUserId: profile.id,
        parabolName: profile.preferredName,
        parabolEmail: profile.email,
        encryptedToken: encrypted.encryptedText,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        keyVersion: encrypted.keyVersion,
        maskedPrefix,
        baseUrl,
        status: 'ACTIVE',
        isActive: true,
        expiresAt: profile.expiresAt ?? null,
        lastVerifiedAt: new Date(),
      },
      update: {
        label,
        parabolName: profile.preferredName,
        parabolEmail: profile.email,
        encryptedToken: encrypted.encryptedText,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        keyVersion: encrypted.keyVersion,
        maskedPrefix,
        baseUrl,
        status: 'ACTIVE',
        isActive: true,
        expiresAt: profile.expiresAt ?? null,
        lastVerifiedAt: new Date(),
      },
    });

    await this.logAudit(
      userId,
      'PARABOL_PAT_SAVE',
      'SUCCESS',
      meta,
      `Connected Parabol account ${profile.preferredName}`,
    );

    return this.toSummary(saved);
  }

  async switchActiveConnection(
    userId: string,
    id: string,
    meta?: RequestMetadata,
  ): Promise<ParabolConnectionSummary[]> {
    const existing = await this.prisma.parabolConnection.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Parabol connection not found.');
    }

    await this.prisma.parabolConnection.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    await this.prisma.parabolConnection.update({
      where: { id: existing.id },
      data: { isActive: true },
    });

    this.standupsCache.clear();
    await this.logAudit(
      userId,
      'PARABOL_SWITCH_ACTIVE',
      'SUCCESS',
      meta,
      `Switched active Parabol account to ${existing.parabolName || existing.label}`,
    );

    return this.listConnections(userId);
  }

  async deleteConnection(
    userId: string,
    id: string,
    meta?: RequestMetadata,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.parabolConnection.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Parabol connection not found.');
    }

    await this.prisma.parabolConnection.delete({ where: { id: existing.id } });
    this.standupsCache.delete(existing.id);

    if (existing.isActive) {
      const next = await this.prisma.parabolConnection.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await this.prisma.parabolConnection.update({
          where: { id: next.id },
          data: { isActive: true },
        });
      }
    }

    await this.logAudit(
      userId,
      'PARABOL_DISCONNECT',
      'SUCCESS',
      meta,
      `Disconnected Parabol account ${existing.parabolName || existing.label}`,
    );

    return { success: true };
  }

  async listActiveStandups(
    userId: string,
    options?: { connectionId?: string; meetingUrl?: string; forceRefresh?: boolean },
    meta?: RequestMetadata,
  ): Promise<ListParabolStandupsResult> {
    const active = options?.connectionId
      ? await this.prisma.parabolConnection.findFirst({
          where: { id: options.connectionId, userId },
        })
      : await this.prisma.parabolConnection.findFirst({
          where: { userId, isActive: true },
          orderBy: { updatedAt: 'desc' },
        });

    if (!active) {
      return {
        connected: false,
        connection: null,
        meetings: [],
      };
    }

    const token = this.decryptConnectionToken(active);
    const parsedMeetingId = options?.meetingUrl ? parseParabolMeetingId(options.meetingUrl) : null;

    if (options?.meetingUrl && !parsedMeetingId) {
      throw new BadRequestException(
        'Invalid Parabol meeting URL or ID. Expected format: https://action.parabol.co/meet/<meeting-id>',
      );
    }

    if (!parsedMeetingId && !options?.forceRefresh) {
      const cached = this.standupsCache.get(active.id);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          connected: true,
          connection: this.toSummary(active),
          meetings: cached.meetings,
        };
      }
    }

    try {
      let meetings: ParabolStandupMeeting[];
      if (parsedMeetingId) {
        const single = await this.parabolClient.fetchStandupMeetingById(token, parsedMeetingId);
        meetings = [single];
      } else {
        meetings = await this.parabolClient.fetchActiveStandupMeetings(token);
        this.standupsCache.set(active.id, {
          expiresAt: Date.now() + STANDUP_CACHE_TTL_MS,
          meetings,
        });
      }

      const updatedConn = await this.prisma.parabolConnection.update({
        where: { id: active.id },
        data: { status: 'ACTIVE', lastVerifiedAt: new Date() },
      });

      return {
        connected: true,
        connection: this.toSummary(updatedConn),
        meetings,
      };
    } catch (error) {
      return this.handleClientError(active, error, 'PARABOL_STANDUPS_FETCH', meta);
    }
  }

  async submitStandup(
    userId: string,
    dto: SubmitParabolStandupDto,
    meta?: RequestMetadata,
  ): Promise<SubmitParabolStandupResult> {
    const conn = await this.resolveActiveConnection(userId, dto.connectionId);
    const token = this.decryptConnectionToken(conn);

    const parsedMeetingId = parseParabolMeetingId(dto.meetingId);
    if (!parsedMeetingId) {
      throw new BadRequestException('Invalid Parabol meeting ID.');
    }

    const content = buildParabolTipTapContent(dto.bullets, {
      includeTodayHeader: dto.includeTodayHeader,
    });

    try {
      const upserted = await this.parabolClient.upsertTeamPromptResponse(token, {
        meetingId: parsedMeetingId,
        promptId: dto.promptId,
        content,
      });

      let shared = Boolean(upserted.sharedAt);
      let sharedAt = upserted.sharedAt;

      if (dto.shareImmediately) {
        const sharedResult = await this.parabolClient.shareTeamPromptResponses(
          token,
          parsedMeetingId,
        );
        shared = true;
        sharedAt = sharedResult.sharedAt ?? new Date().toISOString();
      }

      this.standupsCache.delete(conn.id);
      await this.prisma.parabolConnection.update({
        where: { id: conn.id },
        data: { status: 'ACTIVE', lastUsedAt: new Date() },
      });

      await this.logAudit(
        userId,
        'PARABOL_STANDUP_SUBMIT',
        'SUCCESS',
        meta,
        `Submitted standup to meeting ${upserted.meetingId} (shared=${String(shared)})`,
      );

      return {
        success: true,
        responseId: upserted.responseId,
        meetingId: upserted.meetingId,
        meetingName: upserted.meetingName,
        meetingUrl: buildParabolMeetingUrl(upserted.meetingId),
        promptId: upserted.promptId,
        shared,
        sharedAt,
      };
    } catch (error) {
      return this.handleClientError(conn, error, 'PARABOL_STANDUP_SUBMIT', meta);
    }
  }
}
