import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SsoCallbackDto {
  @ApiProperty({
    description: "OAuth2 Authorization Code issued by Central Gateway",
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: "PKCE Code Verifier generated during SSO initiation",
  })
  @IsString()
  @IsNotEmpty()
  code_verifier!: string;
}
