import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { GitHubModule } from "../github/github.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [GitHubModule, AuthModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
