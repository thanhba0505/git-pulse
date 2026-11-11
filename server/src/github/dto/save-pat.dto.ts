import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SavePatDto {
  @ApiProperty({
    description: "GitHub Personal Access Token (Classic or Fine-grained)",
  })
  @IsNotEmpty()
  @IsString()
  token!: string;
}

export class OAuthCallbackDto {
  @ApiProperty({ description: "GitHub OAuth temporary code" })
  @IsNotEmpty()
  @IsString()
  code!: string;
}
