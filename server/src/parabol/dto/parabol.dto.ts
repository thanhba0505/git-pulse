import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class VerifyParabolTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Parabol Personal Access Token is required.' })
  @MaxLength(512)
  token!: string;
}

export class CreateParabolConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class SubmitParabolStandupDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  meetingId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  promptId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  bullets!: string[];

  @IsOptional()
  @IsBoolean()
  shareImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  includeTodayHeader?: boolean;
}
