import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class GoogleLoginDto {
  @ApiPropertyOptional({
    description: "Google ID token (credential) from Google Identity Services",
  })
  @IsOptional()
  @IsString()
  credential?: string;

  @ApiPropertyOptional({
    description: "Email (used for local dev / testing)",
    example: "developer@wonderlab.local",
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: "Full name from Google profile",
    example: "Cosmic Developer",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Google Subject ID (sub)",
    example: "google_sub_10928301928301298",
  })
  @IsOptional()
  @IsString()
  googleId?: string;
}
