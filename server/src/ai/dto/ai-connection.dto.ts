import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUPPORTED_AI_PROVIDERS = ['GOOGLE_GEMINI', 'GROQ'] as const;
export type SupportedAiProvider = (typeof SUPPORTED_AI_PROVIDERS)[number];

export const VALID_AI_ENGINES = ['GITHUB_MODELS', 'GOOGLE_GEMINI', 'GROQ'] as const;
export type ValidAiEngine = (typeof VALID_AI_ENGINES)[number];

export class PreviewAiModelsDto {
  @ApiProperty({ enum: SUPPORTED_AI_PROVIDERS, example: 'GOOGLE_GEMINI' })
  @IsIn(SUPPORTED_AI_PROVIDERS)
  provider!: SupportedAiProvider;

  @ApiProperty({ example: 'AIza...' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập API Key.' })
  @MaxLength(512)
  apiKey!: string;
}

export class CreateAiConnectionDto {
  @ApiProperty({ enum: SUPPORTED_AI_PROVIDERS, example: 'GOOGLE_GEMINI' })
  @IsIn(SUPPORTED_AI_PROVIDERS)
  provider!: SupportedAiProvider;

  @ApiProperty({ example: 'AIza...' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập API Key.' })
  @MaxLength(512)
  apiKey!: string;

  @ApiPropertyOptional({ example: 'Tài khoản cá nhân' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.999Z',
    description: 'ISO date string or null',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CheckAvailabilityDto {
  @ApiProperty({ enum: VALID_AI_ENGINES, example: 'GOOGLE_GEMINI' })
  @IsIn(VALID_AI_ENGINES)
  engine!: ValidAiEngine;

  @ApiPropertyOptional({ example: 'uuid-connection-id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  connectionId?: string;

  @ApiProperty({ example: 'gemini-2.5-flash' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  model!: string;
}
