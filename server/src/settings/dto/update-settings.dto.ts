import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  FetchRoleScope,
  FetchTimeRange,
  GroupingMode,
  PrStateFilter,
  VALID_FETCH_ROLES,
  VALID_GROUPING_MODES,
  VALID_PR_STATES,
  VALID_TIME_RANGES,
} from '../settings.types';

export class UpdateFetchPreferencesDto {
  @ApiPropertyOptional({ enum: VALID_GROUPING_MODES })
  @IsOptional()
  @IsIn(VALID_GROUPING_MODES)
  defaultGroupBy?: GroupingMode;

  @ApiPropertyOptional({ enum: VALID_TIME_RANGES })
  @IsOptional()
  @IsIn(VALID_TIME_RANGES)
  defaultTimeRange?: FetchTimeRange;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includePersonal?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  includedOrgs?: string[];

  @ApiPropertyOptional({ enum: VALID_PR_STATES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(VALID_PR_STATES, { each: true })
  prStates?: PrStateFilter[];

  @ApiPropertyOptional({ enum: VALID_FETCH_ROLES })
  @IsOptional()
  @IsIn(VALID_FETCH_ROLES)
  fetchRole?: FetchRoleScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeDirectCommits?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includePrWithoutCommitsInRange?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  compactCommits?: boolean;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['vi', 'en'] })
  @IsOptional()
  @IsIn(['vi', 'en'])
  language?: 'vi' | 'en';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoCopyToClipboard?: boolean;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customPrompt?: string;

  @ApiPropertyOptional({ type: UpdateFetchPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFetchPreferencesDto)
  fetchPreferences?: UpdateFetchPreferencesDto;
}
