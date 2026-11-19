import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AiService } from './ai.service';
import { CheckAvailabilityDto, CreateAiConnectionDto } from './dto/ai-connection.dto';
import { SummarizeDto } from './dto/summarize.dto';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI Intelligence')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('connections')
  @ApiOperation({ summary: 'List user saved AI provider connections (masked keys only)' })
  async listConnections(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.aiService.listConnections(req.user.id);
  }

  @Post('connections')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify and encrypt a personal AI provider API key' })
  async createConnection(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateAiConnectionDto,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.aiService.createConnection(req.user.id, dto, req.user.username, meta);
  }

  @Patch('connections/:id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate or update a saved AI provider API key' })
  async updateConnection(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: CreateAiConnectionDto,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.aiService.updateConnection(req.user.id, id, dto, req.user.username, meta);
  }

  @Delete('connections/:id')
  @ApiOperation({ summary: 'Delete a saved personal AI provider connection' })
  async deleteConnection(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.aiService.deleteConnection(req.user.id, id, meta);
  }

  @Post('check-availability')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Check live availability of an AI provider and model' })
  async checkAvailability(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CheckAvailabilityDto,
  ) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.aiService.checkAvailability(req.user.id, dto, meta);
  }

  @Post('summarize')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Summarize PRs and Commits using selected AI provider' })
  async summarize(@Req() req: Request & { user: AuthenticatedUser }, @Body() dto: SummarizeDto) {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.aiService.summarize(req.user.id, dto, meta);
  }
}
