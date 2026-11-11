import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Request } from "express";
import { GitHubService } from "./github.service";
import { SavePatDto, OAuthCallbackDto } from "./dto/save-pat.dto";
import { JwtAuthGuard, AuthenticatedUser } from "../auth/guards/jwt-auth.guard";

@ApiTags("GitHub Integration")
@Controller("github")
@UseGuards(JwtAuthGuard)
export class GitHubController {
  constructor(private readonly gitHubService: GitHubService) {}

  @Post("pat")
  @ApiOperation({ summary: "Save GitHub Personal Access Token" })
  async savePat(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: SavePatDto,
  ) {
    return this.gitHubService.savePersonalAccessToken(req.user.id, dto.token);
  }

  @Post("oauth")
  @ApiOperation({ summary: "Exchange GitHub OAuth temporary code" })
  async exchangeOAuth(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: OAuthCallbackDto,
  ) {
    return this.gitHubService.exchangeOAuthCode(req.user.id, dto.code);
  }

  @Get("status")
  @ApiOperation({ summary: "Check GitHub connection status" })
  async getStatus(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.gitHubService.getStatus(req.user.id);
  }

  @Delete("disconnect")
  @ApiOperation({ summary: "Disconnect GitHub account" })
  async disconnect(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.gitHubService.disconnect(req.user.id);
  }

  @Get("activity")
  @ApiOperation({ summary: "Fetch Pull Requests and Commits updated today" })
  async getActivity(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query("since") since?: string,
  ) {
    return this.gitHubService.fetchActivity(req.user.id, since);
  }
}
