import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_TASK_COLORS = ['sky', 'indigo', 'emerald', 'amber', 'rose'] as const;
export type TaskColor = (typeof VALID_TASK_COLORS)[number];

export class TaskItemInputDto {
  @ApiProperty({ example: 'owner/repo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  repo!: string;

  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  prNumber!: number;

  @ApiProperty({ example: 'feat: implement sso pkce callback' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiProperty({ example: 'https://github.com/owner/repo/pull/42' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prUrl!: string;

  @ApiPropertyOptional({ example: 'draft' })
  @IsOptional()
  @IsIn(['draft', 'open', 'merged', 'closed', 'direct_commits'])
  state?: string;

  @ApiPropertyOptional({ example: 'personal' })
  @IsOptional()
  @IsIn(['personal', 'organization'])
  ownerType?: string;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Tích hợp SSO Gateway' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ enum: VALID_TASK_COLORS })
  @IsOptional()
  @IsIn(VALID_TASK_COLORS)
  color?: TaskColor;

  @ApiPropertyOptional({ type: [TaskItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemInputDto)
  items?: TaskItemInputDto[];
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Refactor Layout & SSO' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ enum: VALID_TASK_COLORS })
  @IsOptional()
  @IsIn(VALID_TASK_COLORS)
  color?: TaskColor;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class AddTaskItemsDto {
  @ApiProperty({ type: [TaskItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemInputDto)
  items!: TaskItemInputDto[];
}
