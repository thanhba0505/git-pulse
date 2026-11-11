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
import { Throttle } from "@nestjs/throttler";
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
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Max 5 token verification attempts per min
  @ApiOperation({ summary: "Save GitHub Personal Access Token" })
  async savePat(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: SavePatDto,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
    return this.gitHubService.savePersonalAccessToken(
      req.user.id,
      dto.token,
      "PAT",
      meta,
    );
  }

  @Post("oauth")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Exchange GitHub OAuth temporary code" })
  async exchangeOAuth(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: OAuthCallbackDto,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
    return this.gitHubService.exchangeOAuthCode(req.user.id, dto.code, meta);
  }

  @Get("status")
  @ApiOperation({ summary: "Check GitHub connection status" })
  async getStatus(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.gitHubService.getStatus(req.user.id);
  }

  @Delete("disconnect")
  @ApiOperation({ summary: "Disconnect GitHub account" })
  async disconnect(@Req() req: Request & { user: AuthenticatedUser }) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
    return this.gitHubService.disconnect(req.user.id, meta);
  }

  @Get("activity")
  @ApiOperation({ summary: "Fetch Pull Requests and Commits updated today" })
  async getActivity(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query("since") since?: string,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
    return this.gitHubService.fetchActivity(req.user.id, since, meta);
  }
}
