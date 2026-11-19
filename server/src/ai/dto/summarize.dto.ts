import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VALID_AI_ENGINES, ValidAiEngine } from './ai-connection.dto';

export class PrItemDto {
  @ApiProperty({ example: 'owner/repo' })
  @IsString()
  repo!: string;

  @ApiProperty({ example: 'feat: add AI provider vault' })
  @IsString()
  title!: string;

  @ApiProperty({ example: ['commit 1', 'commit 2'] })
  @IsArray()
  commits!: string[];
}

export class SummarizeDto {
  @ApiProperty({ type: [PrItemDto] })
  @IsArray()
  prs!: PrItemDto[];

  @ApiPropertyOptional({ enum: VALID_AI_ENGINES, example: 'GOOGLE_GEMINI' })
  @IsOptional()
  @IsIn(VALID_AI_ENGINES)
  engine?: ValidAiEngine;

  @ApiPropertyOptional({ example: 'uuid-connection-id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  connectionId?: string;

  @ApiPropertyOptional({ example: 'gemini-2.5-flash' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional({ example: 'STANDUP_BULLETS' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ example: 'vi' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 'Tùy chỉnh thêm...', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customPrompt?: string;
}
