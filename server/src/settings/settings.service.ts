import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_FETCH_PREFERENCES,
  DEFAULT_QUICK_ACCESS_URL,
  FetchPreferences,
  normalizeFetchPreferences,
} from './settings.types';

export interface UserSettingsResponse {
  language: string;
  autoCopyToClipboard: boolean;
  customPrompt: string;
  quickAccessUrl: string;
  fetchPreferences: FetchPreferences;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<UserSettingsResponse> {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: {
          userId,
          defaultAiEngine: 'GITHUB_MODELS',
          githubModelName: 'gpt-4o-mini',
          language: 'vi',
          fetchPreferences: DEFAULT_FETCH_PREFERENCES as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const prefs = normalizeFetchPreferences(settings.fetchPreferences);
    return {
      language: settings.language,
      autoCopyToClipboard: settings.autoCopyToClipboard,
      customPrompt: settings.customPrompt ?? '',
      quickAccessUrl: prefs.quickAccessUrl ?? DEFAULT_QUICK_ACCESS_URL,
      fetchPreferences: prefs,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettingsResponse> {
    const current = await this.getSettings(userId);
    const nextQuickAccessUrl =
      dto.quickAccessUrl !== undefined
        ? dto.quickAccessUrl.trim() || DEFAULT_QUICK_ACCESS_URL
        : dto.fetchPreferences?.quickAccessUrl !== undefined
          ? dto.fetchPreferences.quickAccessUrl.trim() || DEFAULT_QUICK_ACCESS_URL
          : current.fetchPreferences.quickAccessUrl;

    const mergedPreferences = normalizeFetchPreferences({
      ...current.fetchPreferences,
      ...(dto.fetchPreferences ?? {}),
      quickAccessUrl: nextQuickAccessUrl,
    });
    const normalizedCustomPrompt =
      dto.customPrompt !== undefined ? dto.customPrompt.trim() || null : undefined;

    const updated = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.autoCopyToClipboard !== undefined
          ? { autoCopyToClipboard: dto.autoCopyToClipboard }
          : {}),
        ...(normalizedCustomPrompt !== undefined ? { customPrompt: normalizedCustomPrompt } : {}),
        fetchPreferences: mergedPreferences as unknown as Prisma.InputJsonValue,
      },
      create: {
        userId,
        defaultAiEngine: 'GITHUB_MODELS',
        githubModelName: 'gpt-4o-mini',
        language: dto.language ?? 'vi',
        autoCopyToClipboard: dto.autoCopyToClipboard ?? true,
        ...(normalizedCustomPrompt !== undefined ? { customPrompt: normalizedCustomPrompt } : {}),
        fetchPreferences: mergedPreferences as unknown as Prisma.InputJsonValue,
      },
    });

    const updatedPrefs = normalizeFetchPreferences(updated.fetchPreferences);
    return {
      language: updated.language,
      autoCopyToClipboard: updated.autoCopyToClipboard,
      customPrompt: updated.customPrompt ?? '',
      quickAccessUrl: updatedPrefs.quickAccessUrl ?? DEFAULT_QUICK_ACCESS_URL,
      fetchPreferences: updatedPrefs,
    };
  }
}
