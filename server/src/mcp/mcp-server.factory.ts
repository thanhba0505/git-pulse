import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { APP_VERSION } from '../common/version';
import { redactTokens } from '../common/token-redactor.util';
import {
  VALID_FETCH_ROLES,
  VALID_GROUPING_MODES,
  VALID_PR_STATES,
  VALID_TIME_RANGES,
} from '../settings/settings.types';
import { VALID_TASK_COLORS } from '../tasks/dto/task.dto';
import { McpScope } from './mcp.constants';
import { McpExecutionContext, McpToolsService } from './mcp-tools.service';

const PR_STATE_VALUES = ['draft', 'open', 'merged', 'closed', 'direct_commits'] as const;

const taskItemInputSchema = z.object({
  repo: z.string().min(1).max(255),
  prNumber: z.number().int().min(0),
  title: z.string().min(1).max(300),
  prUrl: z.string().min(1).max(500),
  state: z.enum(PR_STATE_VALUES).optional(),
  ownerType: z.enum(['personal', 'organization']).optional(),
});

function formatJsonResult(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

@Injectable()
export class McpServerFactory {
  constructor(private readonly toolsService: McpToolsService) {}

  createForContext(ctx: McpExecutionContext): McpServer {
    const server = new McpServer(
      {
        name: 'git-pulse-mcp',
        version: APP_VERSION,
      },
      {
        instructions:
          'Git Pulse MCP Server: query GitHub PR/commit activity, group PRs into TrackingTasks, synthesize AI standup reports (via account BYOK Gemini/Groq or save external agent summaries), manage preferences, and submit drafts to Parabol.',
      },
    );

    this.registerGitHubTools(server, ctx);
    this.registerTaskTools(server, ctx);
    this.registerAiAndReportTools(server, ctx);
    this.registerSettingsAndParabolTools(server, ctx);
    this.registerResources(server, ctx);
    this.registerPrompts(server);

    return server;
  }

  private async runScopedTool(
    ctx: McpExecutionContext,
    toolName: string,
    requiredScopes: readonly McpScope[],
    handler: () => Promise<unknown>,
  ): Promise<CallToolResult> {
    try {
      this.toolsService.assertScopes(ctx.scopes, requiredScopes);
      const data = await handler();
      await this.toolsService.recordToolAudit(ctx, toolName, 'SUCCESS');
      return formatJsonResult(data);
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = redactTokens(rawMessage);
      await this.toolsService.recordToolAudit(ctx, toolName, 'FAILED', safeMessage);
      return {
        content: [{ type: 'text', text: safeMessage }],
        isError: true,
      };
    }
  }

  private registerGitHubTools(server: McpServer, ctx: McpExecutionContext): void {
    server.registerTool(
      'get_github_status',
      {
        title: 'Get GitHub Connection Status',
        description:
          'Check connected GitHub accounts and active account status (never exposes tokens).',
        annotations: { readOnlyHint: true },
      },
      () =>
        this.runScopedTool(ctx, 'get_github_status', ['read:activity'], () =>
          this.toolsService.getGitHubStatus(ctx),
        ),
    );

    server.registerTool(
      'get_github_workspaces',
      {
        title: 'List GitHub Workspaces',
        description:
          'List personal and organization GitHub workspaces accessible by the active account.',
        annotations: { readOnlyHint: true },
      },
      () =>
        this.runScopedTool(ctx, 'get_github_workspaces', ['read:activity'], () =>
          this.toolsService.getGitHubWorkspaces(ctx),
        ),
    );

    server.registerTool(
      'switch_active_github_account',
      {
        title: 'Switch Active GitHub Account',
        description: 'Switch which linked GitHub account is active for activity scans.',
        inputSchema: {
          accountId: z.string().min(1).describe('GitAccount UUID from get_github_status'),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'switch_active_github_account', ['write:activity'], () =>
          this.toolsService.switchActiveGitHubAccount(ctx, args.accountId),
        ),
    );

    server.registerTool(
      'get_github_activity',
      {
        title: 'Scan GitHub PR & Commit Activity',
        description:
          'Fetch Pull Requests and direct commits matching user preferences or explicit date/repo/state filters.',
        inputSchema: {
          since: z.string().optional().describe('ISO 8601 start timestamp (optional)'),
          ownerType: z.enum(['all', 'personal', 'organization']).optional(),
          state: z.enum(['all', ...PR_STATE_VALUES]).optional(),
          repo: z.string().optional().describe('Substring filter for owner/repo'),
          includeCommits: z.boolean().optional().describe('Include commit messages (default true)'),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'get_github_activity', ['read:activity'], () =>
          this.toolsService.getGitHubActivity(ctx, args),
        ),
    );

    server.registerTool(
      'resolve_pull_request',
      {
        title: 'Resolve Pull Request Metadata',
        description:
          'Resolve a GitHub PR URL or owner/repo#number into full PR metadata and commits.',
        inputSchema: {
          ref: z
            .string()
            .min(3)
            .describe('PR URL (https://github.com/owner/repo/pull/42) or owner/repo#42'),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'resolve_pull_request', ['read:activity'], () =>
          this.toolsService.resolvePullRequest(ctx, args.ref),
        ),
    );
  }

  private registerTaskTools(server: McpServer, ctx: McpExecutionContext): void {
    server.registerTool(
      'list_task_groups',
      {
        title: 'List PR Task Groups',
        description: 'List TrackingTask groups and their assigned Pull Requests.',
        inputSchema: {
          includeCompleted: z
            .boolean()
            .optional()
            .describe('Include completed tasks (default false)'),
          search: z.string().optional().describe('Filter by task title, PR title, or repo'),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'list_task_groups', ['read:tasks'], () =>
          this.toolsService.listTaskGroups(ctx, args),
        ),
    );

    server.registerTool(
      'create_task_group',
      {
        title: 'Create PR Task Group',
        description:
          'Create a new TrackingTask and attach a list of PRs (via prRefs like owner/repo#123 or GitHub PR URLs, or pre-resolved items).',
        inputSchema: {
          title: z.string().min(1).max(160).describe('Task group title'),
          color: z
            .enum(VALID_TASK_COLORS)
            .optional()
            .describe('Accent color (sky, indigo, emerald, amber, rose)'),
          prRefs: z
            .array(z.string().min(3))
            .max(25)
            .optional()
            .describe('List of PR URLs or owner/repo#number to auto-resolve and attach'),
          items: z.array(taskItemInputSchema).max(25).optional(),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'create_task_group', ['write:tasks'], () =>
          this.toolsService.createTaskGroup(ctx, args),
        ),
    );

    server.registerTool(
      'batch_create_task_groups',
      {
        title: 'Batch Create PR Task Groups',
        description:
          'Create multiple TrackingTask groups with their PR lists in a single call (max 10 groups).',
        inputSchema: {
          groups: z
            .array(
              z.object({
                title: z.string().min(1).max(160),
                color: z.enum(VALID_TASK_COLORS).optional(),
                prRefs: z.array(z.string().min(3)).max(25).optional(),
                items: z.array(taskItemInputSchema).max(25).optional(),
              }),
            )
            .min(1)
            .max(10),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'batch_create_task_groups', ['write:tasks'], () =>
          this.toolsService.batchCreateTaskGroups(ctx, args.groups),
        ),
    );

    server.registerTool(
      'update_task_group',
      {
        title: 'Update PR Task Group',
        description: 'Rename, recolor, or toggle completion status of an existing TrackingTask.',
        inputSchema: {
          taskId: z.string().min(1),
          title: z.string().min(1).max(160).optional(),
          color: z.enum(VALID_TASK_COLORS).optional(),
          isCompleted: z.boolean().optional(),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'update_task_group', ['write:tasks'], () =>
          this.toolsService.updateTaskGroup(ctx, args),
        ),
    );

    server.registerTool(
      'delete_task_group',
      {
        title: 'Delete PR Task Group',
        description: 'Delete a TrackingTask and its PR assignments.',
        inputSchema: {
          taskId: z.string().min(1),
        },
        annotations: { destructiveHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'delete_task_group', ['write:tasks'], () =>
          this.toolsService.deleteTaskGroup(ctx, args.taskId),
        ),
    );

    server.registerTool(
      'add_prs_to_task_group',
      {
        title: 'Add PRs to Task Group',
        description: 'Assign additional Pull Requests to an existing TrackingTask.',
        inputSchema: {
          taskId: z.string().min(1),
          prRefs: z.array(z.string().min(3)).max(25).optional(),
          items: z.array(taskItemInputSchema).max(25).optional(),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'add_prs_to_task_group', ['write:tasks'], () =>
          this.toolsService.addPrsToTaskGroup(ctx, args),
        ),
    );

    server.registerTool(
      'remove_pr_from_task_group',
      {
        title: 'Remove PR from Task Group',
        description: 'Remove a specific PR from a TrackingTask.',
        inputSchema: {
          taskId: z.string().min(1),
          repo: z.string().min(1).describe('Repository full name (owner/repo)'),
          prNumber: z.number().int().min(0),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'remove_pr_from_task_group', ['write:tasks'], () =>
          this.toolsService.removePrFromTaskGroup(ctx, args),
        ),
    );

    server.registerTool(
      'sync_task_pr_states',
      {
        title: 'Sync Task PR States',
        description:
          'Refresh live GitHub open/draft/merged/closed statuses for all stored task PRs.',
      },
      () =>
        this.runScopedTool(ctx, 'sync_task_pr_states', ['write:tasks'], () =>
          this.toolsService.syncTaskPrStates(ctx),
        ),
    );
  }

  private registerAiAndReportTools(server: McpServer, ctx: McpExecutionContext): void {
    server.registerTool(
      'list_ai_connections',
      {
        title: 'List Account AI Connections',
        description:
          'List saved BYOK AI provider connections (Google Gemini / Groq) and available models without exposing keys.',
        annotations: { readOnlyHint: true },
      },
      () =>
        this.runScopedTool(ctx, 'list_ai_connections', ['ai:summarize'], () =>
          this.toolsService.listAiConnections(ctx),
        ),
    );

    server.registerTool(
      'check_ai_availability',
      {
        title: 'Check AI Model Availability',
        description:
          'Probe live readiness of a configured Google Gemini or Groq model before summarizing.',
        inputSchema: {
          engine: z.enum(['GOOGLE_GEMINI', 'GROQ']).optional(),
          connectionId: z.string().optional(),
          model: z.string().optional(),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'check_ai_availability', ['ai:summarize'], () =>
          this.toolsService.checkAiAvailability(ctx, args),
        ),
    );

    server.registerTool(
      'summarize_prs_ai',
      {
        title: 'Summarize PRs with Account AI',
        description:
          'Synthesize a standup summary using the user’s configured Google Gemini or Groq connection from taskIds, prRefs, explicit prs, or recent GitHub activity, and persist to ReportHistory.',
        inputSchema: {
          taskId: z.string().optional().describe('Summarize PRs belonging to a single task'),
          taskIds: z
            .array(z.string())
            .max(20)
            .optional()
            .describe('Summarize PRs across multiple tasks'),
          prRefs: z.array(z.string()).max(25).optional().describe('PR URLs or owner/repo#number'),
          prs: z
            .array(
              z.object({
                repo: z.string(),
                title: z.string(),
                commits: z.array(z.string()),
              }),
            )
            .optional(),
          since: z.string().optional().describe('ISO 8601 timestamp when scanning recent activity'),
          ownerType: z.enum(['all', 'personal', 'organization']).optional(),
          state: z.enum(['all', ...PR_STATE_VALUES]).optional(),
          repo: z.string().optional(),
          engine: z.enum(['GOOGLE_GEMINI', 'GROQ']).optional(),
          connectionId: z.string().optional(),
          model: z.string().optional(),
          tone: z.string().optional(),
          language: z.enum(['vi', 'en']).optional(),
          customPrompt: z.string().max(2000).optional(),
          groupByTask: z.boolean().optional(),
          saveToHistory: z
            .boolean()
            .optional()
            .describe('Persist summary to ReportHistory (default true)'),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'summarize_prs_ai', ['ai:summarize', 'write:reports'], () =>
          this.toolsService.summarizePrsAi(ctx, args),
        ),
    );

    server.registerTool(
      'save_report',
      {
        title: 'Save External Agent Summary Report',
        description:
          'Persist a standup summary generated directly by the connected AI agent into Git Pulse ReportHistory.',
        inputSchema: {
          bullets: z.array(z.string().min(1)).optional().describe('Pre-summarized standup bullets'),
          summaryText: z
            .string()
            .optional()
            .describe('Raw markdown/bullet text if bullets array not provided'),
          prs: z
            .array(
              z.object({
                repo: z.string(),
                title: z.string(),
                commits: z.array(z.string()).optional(),
              }),
            )
            .optional(),
          taskIds: z.array(z.string()).optional().describe('Optional linked TrackingTask IDs'),
          modelName: z
            .string()
            .max(120)
            .optional()
            .describe('Optional agent/model label (e.g. claude-sonnet)'),
          dateRangeStart: z.string().optional(),
          dateRangeEnd: z.string().optional(),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'save_report', ['write:reports'], () =>
          this.toolsService.saveReport(ctx, args),
        ),
    );

    server.registerTool(
      'list_reports',
      {
        title: 'List Report Histories',
        description: 'List recent standup reports saved in Git Pulse ReportHistory.',
        inputSchema: {
          limit: z.number().int().min(1).max(50).optional(),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'list_reports', ['read:reports'], () =>
          this.toolsService.listReports(ctx, args.limit),
        ),
    );

    server.registerTool(
      'get_report',
      {
        title: 'Get Report Detail',
        description: 'Get full details of a saved standup report by ID.',
        inputSchema: {
          reportId: z.string().min(1),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'get_report', ['read:reports'], () =>
          this.toolsService.getReport(ctx, args.reportId),
        ),
    );

    server.registerTool(
      'delete_report',
      {
        title: 'Delete Report',
        description: 'Delete a report entry from ReportHistory.',
        inputSchema: {
          reportId: z.string().min(1),
        },
        annotations: { destructiveHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'delete_report', ['write:reports'], () =>
          this.toolsService.deleteReport(ctx, args.reportId),
        ),
    );
  }

  private registerSettingsAndParabolTools(server: McpServer, ctx: McpExecutionContext): void {
    server.registerTool(
      'get_user_settings',
      {
        title: 'Get User Settings',
        description: 'Read user Git Pulse language, customPrompt, and GitHub fetchPreferences.',
        annotations: { readOnlyHint: true },
      },
      () =>
        this.runScopedTool(ctx, 'get_user_settings', ['read:settings'], () =>
          this.toolsService.getUserSettings(ctx),
        ),
    );

    server.registerTool(
      'update_user_settings',
      {
        title: 'Update User Settings',
        description:
          'Update language, customPrompt, autoCopyToClipboard, or GitHub fetchPreferences.',
        inputSchema: {
          language: z.enum(['vi', 'en']).optional(),
          autoCopyToClipboard: z.boolean().optional(),
          customPrompt: z.string().max(2000).optional(),
          quickAccessUrl: z.string().max(500).optional(),
          fetchPreferences: z
            .object({
              defaultGroupBy: z.enum(VALID_GROUPING_MODES).optional(),
              defaultTimeRange: z.enum(VALID_TIME_RANGES).optional(),
              includePersonal: z.boolean().optional(),
              includedOrgs: z.array(z.string().max(80)).optional(),
              prStates: z.array(z.enum(VALID_PR_STATES)).optional(),
              fetchRole: z.enum(VALID_FETCH_ROLES).optional(),
              includeDirectCommits: z.boolean().optional(),
              includePrWithoutCommitsInRange: z.boolean().optional(),
              compactCommits: z.boolean().optional(),
              quickAccessUrl: z.string().max(500).optional(),
            })
            .optional(),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'update_user_settings', ['write:settings'], () =>
          this.toolsService.updateUserSettings(ctx, args),
        ),
    );

    server.registerTool(
      'list_parabol_connections',
      {
        title: 'List Parabol Connections',
        description: 'List connected Parabol workspace accounts (non-secret metadata only).',
        annotations: { readOnlyHint: true },
      },
      () =>
        this.runScopedTool(ctx, 'list_parabol_connections', ['write:parabol'], () =>
          this.toolsService.listParabolConnections(ctx),
        ),
    );

    server.registerTool(
      'switch_active_parabol_connection',
      {
        title: 'Switch Active Parabol Connection',
        description: 'Set which connected Parabol account is active.',
        inputSchema: {
          connectionId: z.string().min(1),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'switch_active_parabol_connection', ['write:parabol'], () =>
          this.toolsService.switchActiveParabolConnection(ctx, args.connectionId),
        ),
    );

    server.registerTool(
      'list_parabol_standups',
      {
        title: 'List Active Parabol Standups',
        description:
          'Fetch active TeamPromptMeeting standups and prompt IDs from Parabol (or resolve a meetingUrl).',
        inputSchema: {
          connectionId: z.string().optional(),
          meetingUrl: z.string().optional(),
          refresh: z.boolean().optional(),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        this.runScopedTool(ctx, 'list_parabol_standups', ['write:parabol'], () =>
          this.toolsService.listParabolStandups(ctx, args),
        ),
    );

    server.registerTool(
      'submit_parabol_standup',
      {
        title: 'Submit Standup to Parabol',
        description:
          'Submit standup bullets (or a saved reportId) to a Parabol standup prompt. Defaults to Private Draft (shareImmediately: false) unless shareImmediately: true is specified.',
        inputSchema: {
          connectionId: z.string().optional(),
          meetingId: z.string().min(1),
          promptId: z.string().min(1),
          bullets: z.array(z.string().min(1).max(1000)).max(30).optional(),
          reportId: z.string().optional().describe('Use bullets from an existing ReportHistory ID'),
          shareImmediately: z
            .boolean()
            .optional()
            .describe('Publish immediately instead of Private Draft (default false)'),
          includeTodayHeader: z.boolean().optional(),
        },
      },
      (args) =>
        this.runScopedTool(ctx, 'submit_parabol_standup', ['write:parabol'], () =>
          this.toolsService.submitParabolStandup(ctx, args),
        ),
    );
  }

  private registerResources(server: McpServer, ctx: McpExecutionContext): void {
    server.registerResource(
      'recent-activity',
      'gitpulse://activity/recent',
      {
        title: 'Recent GitHub Activity',
        description: 'Latest GitHub Pull Requests and direct commits matching user preferences.',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.toolsService.assertScopes(ctx.scopes, ['read:activity']);
        const activity = await this.toolsService.getGitHubActivity(ctx, {});
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(activity, null, 2),
            },
          ],
        };
      },
    );

    server.registerResource(
      'active-tasks',
      'gitpulse://tasks/active',
      {
        title: 'Active PR Task Groups',
        description: 'Incomplete TrackingTask groups and their assigned Pull Requests.',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.toolsService.assertScopes(ctx.scopes, ['read:tasks']);
        const tasks = await this.toolsService.listTaskGroups(ctx, { includeCompleted: false });
        return {
          contents: [
            { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(tasks, null, 2) },
          ],
        };
      },
    );

    server.registerResource(
      'latest-reports',
      'gitpulse://reports/latest',
      {
        title: 'Latest Standup Reports',
        description: 'Five most recent generated standup reports.',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.toolsService.assertScopes(ctx.scopes, ['read:reports']);
        const reports = await this.toolsService.listReports(ctx, 5);
        return {
          contents: [
            { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(reports, null, 2) },
          ],
        };
      },
    );

    server.registerResource(
      'user-profile-settings',
      'gitpulse://settings/profile',
      {
        title: 'User Settings & AI Providers',
        description: 'Non-secret user preferences and connected AI provider labels.',
        mimeType: 'application/json',
      },
      async (uri) => {
        this.toolsService.assertScopes(ctx.scopes, ['read:settings']);
        const settings = await this.toolsService.getUserSettings(ctx);
        const aiConnections = ctx.scopes.includes('ai:summarize')
          ? await this.toolsService.listAiConnections(ctx)
          : [];
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ settings, aiConnections }, null, 2),
            },
          ],
        };
      },
    );
  }

  private registerPrompts(server: McpServer): void {
    server.registerPrompt(
      'create-task-from-current-prs',
      {
        title: 'Create Task Group From Current PRs',
        description: 'Guide the agent to group related PRs into a Git Pulse TrackingTask.',
        argsSchema: {
          taskTitle: z.string().describe('Name of the task or feature being worked on'),
          prRefs: z.string().optional().describe('Comma-separated PR URLs or owner/repo#number'),
        },
      },
      ({ taskTitle, prRefs }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prRefs
                ? `Create a Git Pulse tracking task titled "${taskTitle}" using create_task_group and attach these PRs: ${prRefs}.`
                : `Check recent GitHub activity with get_github_activity, identify the PRs related to "${taskTitle}", and create a Git Pulse tracking task via create_task_group.`,
            },
          },
        ],
      }),
    );

    server.registerPrompt(
      'daily-standup-pipeline',
      {
        title: 'Daily Standup Pipeline',
        description:
          'Scan PRs/tasks, summarize into standup bullets, save report, and optionally push draft to Parabol.',
        argsSchema: {
          language: z.enum(['vi', 'en']).optional(),
          pushToParabol: z.enum(['true', 'false']).optional(),
        },
      },
      ({ language, pushToParabol }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                '1. Read active tasks (`list_task_groups`) and recent activity (`get_github_activity`).',
                `2. Either call \`summarize_prs_ai\` (language: "${language ?? 'vi'}") if an account AI provider is available, OR synthesize concise standup bullets yourself and persist via \`save_report\`.`,
                pushToParabol === 'true'
                  ? '3. Fetch active meetings via `list_parabol_standups` and submit as a Private Draft via `submit_parabol_standup` (shareImmediately: false) using the saved `reportId`.'
                  : '3. Present the saved report clearly to the user and ask if they want to push it to Parabol.',
              ].join('\n'),
            },
          },
        ],
      }),
    );
  }
}
