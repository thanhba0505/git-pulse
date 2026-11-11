import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "developer" })
  @IsString()
  @IsNotEmpty({ message: "Vui lòng nhập tên đăng nhập" })
  username!: string;

  @ApiProperty({ example: "developer@wonderlab.local" })
  @IsEmail({}, { message: "Địa chỉ email không đúng định dạng" })
  @IsNotEmpty({ message: "Vui lòng nhập email" })
  email!: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" })
  @IsNotEmpty({ message: "Vui lòng nhập mật khẩu" })
  password!: string;
}
