import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MCP_SCOPES, McpScope } from '../mcp.constants';

export class CreateMcpKeyDto {
  @ApiProperty({ example: 'Antigravity IDE (Work Mac)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;

  @ApiPropertyOptional({ enum: MCP_SCOPES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(MCP_SCOPES, { each: true })
  scopes?: McpScope[];

  @ApiPropertyOptional({ example: 90, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
