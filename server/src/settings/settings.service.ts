import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_FETCH_PREFERENCES,
  FetchPreferences,
  normalizeFetchPreferences,
} from './settings.types';

export interface UserSettingsResponse {
  language: string;
  autoCopyToClipboard: boolean;
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

    return {
      language: settings.language,
      autoCopyToClipboard: settings.autoCopyToClipboard,
      fetchPreferences: normalizeFetchPreferences(settings.fetchPreferences),
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettingsResponse> {
    const current = await this.getSettings(userId);
    const mergedPreferences = normalizeFetchPreferences({
      ...current.fetchPreferences,
      ...(dto.fetchPreferences ?? {}),
    });

    const updated = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.autoCopyToClipboard !== undefined
          ? { autoCopyToClipboard: dto.autoCopyToClipboard }
          : {}),
        fetchPreferences: mergedPreferences as unknown as Prisma.InputJsonValue,
      },
      create: {
        userId,
        defaultAiEngine: 'GITHUB_MODELS',
        githubModelName: 'gpt-4o-mini',
        language: dto.language ?? 'vi',
        autoCopyToClipboard: dto.autoCopyToClipboard ?? true,
        fetchPreferences: mergedPreferences as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      language: updated.language,
      autoCopyToClipboard: updated.autoCopyToClipboard,
      fetchPreferences: normalizeFetchPreferences(updated.fetchPreferences),
    };
  }
}
