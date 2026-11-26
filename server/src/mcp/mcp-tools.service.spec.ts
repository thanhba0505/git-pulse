import { ForbiddenException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { GitHubService } from '../github/github.service';
import { ParabolService } from '../parabol/parabol.service';
import { ReportsService } from '../reports/reports.service';
import { SettingsService } from '../settings/settings.service';
import { TasksService } from '../tasks/tasks.service';
import { McpExecutionContext, McpToolsService } from './mcp-tools.service';

describe('McpToolsService', () => {
  const mockGitHubService = {
    getStatus: jest.fn(),
    getWorkspaces: jest.fn(),
    switchActiveAccount: jest.fn(),
    fetchActivity: jest.fn(),
    resolvePullRequest: jest.fn(),
    fetchPullRequestCommits: jest.fn(),
    recordAuditLog: jest.fn().mockResolvedValue(undefined),
  };

  const mockTasksService = {
    listTasks: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    addItems: jest.fn(),
    removeItem: jest.fn(),
    syncTaskItemStates: jest.fn(),
  };

  const mockAiService = {
    listConnections: jest.fn(),
    resolveActiveAiEngine: jest.fn(),
    checkAvailability: jest.fn(),
    summarize: jest.fn(),
  };

  const mockReportsService = {
    listReports: jest.fn(),
    getReportById: jest.fn(),
    createExternalReport: jest.fn(),
    deleteReport: jest.fn(),
  };

  const mockSettingsService = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  };

  const mockParabolService = {
    listConnections: jest.fn(),
    switchActiveConnection: jest.fn(),
    listActiveStandups: jest.fn(),
    submitStandup: jest.fn(),
  };

  const baseCtx: McpExecutionContext = {
    userId: 'user-1',
    username: 'dev',
    scopes: [
      'read:activity',
      'read:tasks',
      'write:tasks',
      'ai:summarize',
      'read:reports',
      'write:reports',
      'write:parabol',
    ],
  };

  let tools: McpToolsService;

  beforeEach(() => {
    jest.clearAllMocks();
    tools = new McpToolsService(
      mockGitHubService as unknown as GitHubService,
      mockTasksService as unknown as TasksService,
      mockAiService as unknown as AiService,
      mockReportsService as unknown as ReportsService,
      mockSettingsService as unknown as SettingsService,
      mockParabolService as unknown as ParabolService,
    );
  });

  it('enforces MCP scopes via assertScopes', () => {
    expect(() => tools.assertScopes(['read:tasks'], ['read:tasks'])).not.toThrow();
    expect(() => tools.assertScopes(['read:tasks'], ['write:tasks'])).toThrow(ForbiddenException);
  });

  it('creates a task group by resolving PR refs through GitHubService', async () => {
    mockGitHubService.resolvePullRequest.mockResolvedValueOnce({
      repo: 'prism-hub/git-pulse',
      owner: 'prism-hub',
      ownerType: 'organization',
      number: 42,
      title: 'feat: add mcp server',
      prUrl: 'https://github.com/prism-hub/git-pulse/pull/42',
      state: 'open',
      activityType: 'pr',
      commits: ['feat: init mcp'],
      commitDetails: [],
    });
    mockTasksService.createTask.mockResolvedValueOnce({
      id: 'task-1',
      title: 'Triển khai MCP',
      color: 'sky',
      items: [{ repo: 'prism-hub/git-pulse', prNumber: 42 }],
    });

    const created = await tools.createTaskGroup(baseCtx, {
      title: 'Triển khai MCP',
      color: 'sky',
      prRefs: ['https://github.com/prism-hub/git-pulse/pull/42'],
    });

    expect(mockGitHubService.resolvePullRequest).toHaveBeenCalledWith(
      'user-1',
      'https://github.com/prism-hub/git-pulse/pull/42',
    );
    expect(mockTasksService.createTask).toHaveBeenCalledWith('user-1', {
      title: 'Triển khai MCP',
      color: 'sky',
      items: [
        {
          repo: 'prism-hub/git-pulse',
          prNumber: 42,
          title: 'feat: add mcp server',
          prUrl: 'https://github.com/prism-hub/git-pulse/pull/42',
          state: 'open',
          ownerType: 'organization',
        },
      ],
    });
    expect(created.id).toBe('task-1');
  });

  it('summarizes PRs inside a task group using active account BYOK AI', async () => {
    mockTasksService.listTasks.mockResolvedValueOnce([
      {
        id: 'task-1',
        title: 'MCP Server',
        isCompleted: false,
        items: [
          {
            repo: 'prism-hub/git-pulse',
            prNumber: 42,
            title: 'feat: mcp controller',
            prUrl: 'https://github.com/prism-hub/git-pulse/pull/42',
            state: 'open',
            ownerType: 'organization',
          },
        ],
      },
    ]);
    mockGitHubService.fetchActivity.mockResolvedValueOnce([]);
    mockGitHubService.fetchPullRequestCommits.mockResolvedValueOnce([
      'feat: add streamable http endpoint',
    ]);
    mockAiService.resolveActiveAiEngine.mockResolvedValueOnce({
      engine: 'GOOGLE_GEMINI',
      connectionId: 'conn-1',
      model: 'gemini-2.5-flash',
    });
    mockSettingsService.getSettings.mockResolvedValueOnce({ language: 'vi' });
    mockAiService.summarize.mockResolvedValueOnce({
      success: true,
      reportId: 'rep-1',
      bullets: ['Triển khai MCP Streamable HTTP endpoint cho Git Pulse.'],
      rawText: '- Triển khai MCP Streamable HTTP endpoint cho Git Pulse.',
      modelUsed: 'gemini-2.5-flash',
      engine: 'GOOGLE_GEMINI',
    });

    const summary = await tools.summarizePrsAi(baseCtx, { taskId: 'task-1' });

    expect(mockAiService.summarize).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        engine: 'GOOGLE_GEMINI',
        connectionId: 'conn-1',
        model: 'gemini-2.5-flash',
        language: 'vi',
        prs: [
          {
            repo: 'prism-hub/git-pulse',
            title: '[Task: MCP Server] feat: mcp controller (#42)',
            commits: ['feat: add streamable http endpoint'],
          },
        ],
      }),
      undefined,
      { saveToHistory: true },
    );
    expect(summary.reportId).toBe('rep-1');
  });

  it('saves an external agent summary report and pushes draft to Parabol by reportId', async () => {
    mockReportsService.createExternalReport.mockResolvedValueOnce({
      id: 'rep-ext-1',
      summaryText: '• Hoàn thành tích hợp MCP',
      prCount: 1,
      commitCount: 0,
      aiEngineUsed: 'MCP_AGENT',
      modelName: 'claude-sonnet',
      createdAt: new Date('2026-11-26T00:00:00Z'),
    });

    const saved = await tools.saveReport(baseCtx, {
      bullets: ['Hoàn thành tích hợp MCP'],
      modelName: 'claude-sonnet',
    });
    expect(saved.reportId).toBe('rep-ext-1');
    expect(saved.aiEngineUsed).toBe('MCP_AGENT');

    mockReportsService.getReportById.mockResolvedValueOnce({
      id: 'rep-ext-1',
      summaryText: '• Hoàn thành tích hợp MCP',
    });
    mockParabolService.submitStandup.mockResolvedValueOnce({
      success: true,
      responseId: 'resp-1',
      shared: false,
    });

    await tools.submitParabolStandup(baseCtx, {
      meetingId: 'meet-1',
      promptId: 'prompt-1',
      reportId: 'rep-ext-1',
    });

    expect(mockParabolService.submitStandup).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        meetingId: 'meet-1',
        promptId: 'prompt-1',
        bullets: ['Hoàn thành tích hợp MCP'],
        shareImmediately: false,
        includeTodayHeader: true,
      }),
      undefined,
    );
  });
});
