import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpController } from './mcp.controller';
import { McpKeysService } from './mcp-keys.service';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolsService } from './mcp-tools.service';
import { AiService } from '../ai/ai.service';
import { GitHubService } from '../github/github.service';
import { ParabolService } from '../parabol/parabol.service';
import { ReportsService } from '../reports/reports.service';
import { SettingsService } from '../settings/settings.service';
import { TasksService } from '../tasks/tasks.service';
import { hashMcpToken, MCP_TOKEN_PREFIX } from './mcp.constants';

describe('McpController (Streamable HTTP JSON-RPC integration)', () => {
  let app: INestApplication;
  let baseUrl: string;

  const syntheticToken = `${MCP_TOKEN_PREFIX}${'x'.repeat(40)}`;

  const mockMcpKeysService = {
    validateToken: jest.fn(async (token: string) => {
      if (hashMcpToken(token) !== hashMcpToken(syntheticToken)) {
        throw new Error('Unauthorized');
      }
      return {
        keyId: 'key-test',
        user: {
          id: 'user-1',
          username: 'dev',
          email: 'dev@example.com',
          avatarUrl: null,
          role: 'USER',
        },
        scopes: ['read:tasks', 'write:tasks'],
      };
    }),
  };

  const mockTasksService = {
    listTasks: jest.fn().mockResolvedValue([
      {
        id: 'task-1',
        title: 'MCP Feature',
        color: 'sky',
        isCompleted: false,
        items: [],
      },
    ]),
  };

  const mockGitHubService = {
    recordAuditLog: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        McpAuthGuard,
        McpServerFactory,
        McpToolsService,
        { provide: McpKeysService, useValue: mockMcpKeysService },
        { provide: GitHubService, useValue: mockGitHubService },
        { provide: TasksService, useValue: mockTasksService },
        { provide: AiService, useValue: {} },
        { provide: ReportsService, useValue: {} },
        { provide: SettingsService, useValue: {} },
        { provide: ParabolService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/mcp`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('handles initialize, tools/list, and tools/call with global ValidationPipe active', async () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${syntheticToken}`,
    };

    const initRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'jest-client', version: '1.0.0' },
        },
      }),
    });
    expect(initRes.status).toBe(200);
    const initJson = (await initRes.json()) as { result?: { serverInfo?: { name?: string } } };
    expect(initJson.result?.serverInfo?.name).toBe('git-pulse-mcp');

    const listRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      result?: { tools?: Array<{ name: string }> };
    };
    const toolNames = listJson.result?.tools?.map((t) => t.name) ?? [];
    expect(toolNames).toContain('create_task_group');
    expect(toolNames).toContain('summarize_prs_ai');
    expect(toolNames).toContain('save_report');

    const callRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_task_groups',
          arguments: {},
        },
      }),
    });
    expect(callRes.status).toBe(200);
    const callJson = (await callRes.json()) as {
      result?: { content?: Array<{ text?: string }>; isError?: boolean };
    };
    expect(callJson.result?.isError).not.toBe(true);
    expect(callJson.result?.content?.[0]?.text).toContain('MCP Feature');

    // Missing scope returns tool error without crashing server
    const forbiddenCall = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_github_activity',
          arguments: {},
        },
      }),
    });
    expect(forbiddenCall.status).toBe(200);
    const forbiddenJson = (await forbiddenCall.json()) as {
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
    };
    expect(forbiddenJson.result?.isError).toBe(true);
    expect(forbiddenJson.result?.content?.[0]?.text).toContain('read:activity');
  });

  it('returns 405 Method Not Allowed on GET /mcp in stateless mode', async () => {
    const res = await fetch(baseUrl, { method: 'GET' });
    expect(res.status).toBe(405);
  });
});
