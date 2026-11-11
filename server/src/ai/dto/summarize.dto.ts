import { IsArray, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PrItemDto {
  @ApiProperty({ example: "owner/repo" })
  @IsString()
  repo!: string;

  @ApiProperty({ example: "feat: add celestial pulse radar" })
  @IsString()
  title!: string;

  @ApiProperty({ example: ["commit 1", "commit 2"] })
  @IsArray()
  commits!: string[];
}

export class SummarizeDto {
  @ApiProperty({ type: [PrItemDto] })
  @IsArray()
  prs!: PrItemDto[];

  @ApiPropertyOptional({ example: "gpt-4o-mini" })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: "STANDUP_BULLETS" })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ example: "vi" })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: "Tùy chỉnh thêm..." })
  @IsOptional()
  @IsString()
  customPrompt?: string;
}
