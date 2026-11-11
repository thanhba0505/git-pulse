import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Request } from "express";
import { AiService } from "./ai.service";
import { SummarizeDto } from "./dto/summarize.dto";
import { JwtAuthGuard, AuthenticatedUser } from "../auth/guards/jwt-auth.guard";

@ApiTags("AI Intelligence")
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("summarize")
  @ApiOperation({
    summary: "Summarize PRs and Commits using GitHub Models API",
  })
  async summarize(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: SummarizeDto,
  ) {
    return this.aiService.summarizeWithGitHubModels(req.user.id, dto);
  }

  @Post("save-client-summary")
  @ApiOperation({
    summary: "Persist WebLLM client-generated summary to history",
  })
  async saveClientSummary(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body()
    body: {
      summary: string[];
      modelName: string;
      prCount: number;
      commitCount: number;
      engine: "WEB_LLM";
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.aiService.saveClientSummary(req.user.id, body);
  }
}
