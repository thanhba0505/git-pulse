import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMcpKeyDto } from './dto/mcp-key.dto';
import { McpKeysService } from './mcp-keys.service';

@ApiTags('MCP API Keys')
@Controller('mcp/keys')
@UseGuards(JwtAuthGuard)
export class McpKeysController {
  constructor(private readonly mcpKeysService: McpKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List user MCP API keys (masked prefixes only)' })
  async listKeys(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.mcpKeysService.listKeys(req.user.id);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a scoped personal MCP API key (raw token shown once)' })
  async createKey(@Req() req: Request & { user: AuthenticatedUser }, @Body() dto: CreateMcpKeyDto) {
    return this.mcpKeysService.createKey(req.user.id, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Revoke an existing MCP API key' })
  async revokeKey(@Req() req: Request & { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.mcpKeysService.revokeKey(req.user.id, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
