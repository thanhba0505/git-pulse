import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: "admin",
    description: "Username or Email address",
  })
  @IsString()
  @IsNotEmpty({ message: "Vui lòng nhập tên đăng nhập hoặc email" })
  username!: string;

  @ApiPropertyOptional({
    example: "password123",
    description: "User password",
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    example: false,
    description: "Dev bypass flag for testing without password",
  })
  @IsBoolean()
  @IsOptional()
  devBypass?: boolean;
}
