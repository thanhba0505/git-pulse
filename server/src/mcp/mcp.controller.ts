import { Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Response } from 'express';
import { McpAuthenticatedRequest, McpAuthGuard } from './mcp-auth.guard';
import { McpServerFactory } from './mcp-server.factory';

@ApiTags('MCP Protocol')
@ApiBearerAuth()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpServerFactory: McpServerFactory) {}

  @Post()
  @UseGuards(McpAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Stateless MCP Streamable HTTP JSON-RPC 2.0 endpoint',
  })
  async handlePost(@Req() req: McpAuthenticatedRequest, @Res() res: Response): Promise<void> {
    const server = this.mcpServerFactory.createForContext({
      userId: req.user.id,
      username: req.user.username,
      scopes: req.mcpScopes,
      meta: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err: unknown) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: err instanceof Error ? err.message : 'Internal MCP server error',
          },
          id: null,
        });
      }
    }
  }

  @Get()
  @ApiOperation({ summary: 'Stateless MCP HTTP GET returns 405 Method Not Allowed per spec' })
  handleGet(@Res() res: Response): void {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Git Pulse MCP operates in stateless POST mode.',
      },
      id: null,
    });
  }

  @Delete()
  @ApiOperation({ summary: 'Stateless MCP HTTP DELETE returns 405 Method Not Allowed per spec' })
  handleDelete(@Res() res: Response): void {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Git Pulse MCP operates in stateless POST mode.',
      },
      id: null,
    });
  }
}
