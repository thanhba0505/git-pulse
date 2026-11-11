import { IsEmail, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class GoogleLoginDto {
  @ApiPropertyOptional({ description: "Google ID Token from client SDK" })
  @IsOptional()
  @IsString()
  credential?: string;

  @ApiPropertyOptional({ description: "User email" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "User display name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "User avatar URL" })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: "Google unique user ID (sub)" })
  @IsOptional()
  @IsString()
  googleId?: string;
}
