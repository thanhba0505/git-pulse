import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { parseStandupBullets } from '../ai/ai-provider.helpers';
import { ValidAiEngine } from '../ai/dto/ai-connection.dto';
import { PrItemDto } from '../ai/dto/summarize.dto';
import { redactTokens } from '../common/token-redactor.util';
import { GitHubService, PrActivity, RequestMetadata } from '../github/github.service';
import { parsePullRequestRef } from '../github/github-activity.helpers';
import { ParabolService } from '../parabol/parabol.service';
import { ReportsService } from '../reports/reports.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateSettingsDto } from '../settings/dto/update-settings.dto';
import { TaskColor, TaskItemInputDto } from '../tasks/dto/task.dto';
import { TasksService } from '../tasks/tasks.service';
import { McpScope } from './mcp.constants';

export interface McpExecutionContext {
  userId: string;
  username: string;
  scopes: McpScope[];
  meta?: RequestMetadata;
}

export interface McpTaskItemInput {
  repo: string;
  prNumber: number;
  title: string;
  prUrl: string;
  state?: 'draft' | 'open' | 'merged' | 'closed' | 'direct_commits';
  ownerType?: 'personal' | 'organization';
}

export interface CreateTaskGroupInput {
  title: string;
  color?: TaskColor;
  prRefs?: string[];
  items?: McpTaskItemInput[];
}

export interface SummarizePrsAiInput {
  taskId?: string;
  taskIds?: string[];
  prRefs?: string[];
  prs?: PrItemDto[];
  since?: string;
  ownerType?: 'all' | 'personal' | 'organization';
  state?: 'all' | 'draft' | 'open' | 'merged' | 'closed' | 'direct_commits';
  repo?: string;
  engine?: 'GOOGLE_GEMINI' | 'GROQ';
  connectionId?: string;
  model?: string;
  tone?: string;
  language?: string;
  customPrompt?: string;
  groupByTask?: boolean;
  saveToHistory?: boolean;
}

export interface SaveReportInput {
  bullets?: string[];
  summaryText?: string;
  prs?: Array<{ repo: string; title: string; commits?: string[] }>;
  taskIds?: string[];
  modelName?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export interface SubmitParabolInput {
  connectionId?: string;
  meetingId: string;
  promptId: string;
  bullets?: string[];
  reportId?: string;
  shareImmediately?: boolean;
  includeTodayHeader?: boolean;
}

const MAX_PR_REFS_PER_CALL = 25;
const RESOLVE_CONCURRENCY = 5;

interface ActivityFilterOptions {
  ownerType?: 'all' | 'personal' | 'organization';
  state?: 'all' | 'draft' | 'open' | 'merged' | 'closed' | 'direct_commits';
  repo?: string;
}

function toTaskItemInput(activity: PrActivity): TaskItemInputDto {
  return {
    repo: activity.repo,
    prNumber: activity.number,
    title: activity.title,
    prUrl: activity.prUrl,
    state: activity.state,
    ownerType: activity.ownerType,
  };
}

function normalizeLookupKey(repo: string, prNumber: number): string {
  return `${repo.trim().toLowerCase()}#${prNumber}`;
}

function filterActivities(
  activities: readonly PrActivity[],
  filter: ActivityFilterOptions,
): PrActivity[] {
  const repoFilter = filter.repo?.trim().toLowerCase();
  return activities.filter((item) => {
    if (filter.ownerType && filter.ownerType !== 'all' && item.ownerType !== filter.ownerType) {
      return false;
    }
    if (filter.state && filter.state !== 'all' && item.state !== filter.state) {
      return false;
    }
    if (repoFilter && !item.repo.toLowerCase().includes(repoFilter)) {
      return false;
    }
    return true;
  });
}

@Injectable()
export class McpToolsService {
  constructor(
    private readonly gitHubService: GitHubService,
    private readonly tasksService: TasksService,
    private readonly aiService: AiService,
    private readonly reportsService: ReportsService,
    private readonly settingsService: SettingsService,
    private readonly parabolService: ParabolService,
  ) {}

  assertScopes(grantedScopes: readonly McpScope[], requiredScopes: readonly McpScope[]): void {
    const granted = new Set<McpScope>(grantedScopes);
    const missing = requiredScopes.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `MCP API Key thiếu quyền thực hiện thao tác này: ${missing.join(', ')}`,
      );
    }
  }

  async recordToolAudit(
    ctx: McpExecutionContext,
    toolName: string,
    status: 'SUCCESS' | 'FAILED',
    details?: string,
  ): Promise<void> {
    const safeDetails = details ? redactTokens(details).slice(0, 450) : undefined;
    await this.gitHubService.recordAuditLog(
      ctx.userId,
      'MCP_TOOL_CALL',
      status,
      safeDetails ? `${toolName}: ${safeDetails}` : toolName,
      ctx.meta,
    );
  }

  // ---------------------------------------------------------------------------
  // GitHub Activity & PR Resolution
  // ---------------------------------------------------------------------------

  async getGitHubStatus(ctx: McpExecutionContext) {
    const status = await this.gitHubService.getStatus(ctx.userId);
    return {
      connected: status.connected,
      activeAccountId: status.activeAccountId ?? null,
      gitUsername: status.gitUsername ?? null,
      tokenStatus: status.tokenStatus ?? null,
      accounts: status.accounts.map((acc) => ({
        id: acc.id,
        gitUsername: acc.gitUsername,
        authType: acc.authType,
        tokenStatus: acc.tokenStatus,
        hasExcessiveScopes: acc.hasExcessiveScopes,
        scopes: acc.scopes,
        expiresAt: acc.expiresAt,
        lastSyncAt: acc.lastSyncAt,
        isActive: acc.isActive,
      })),
    };
  }

  async getGitHubWorkspaces(ctx: McpExecutionContext) {
    return this.gitHubService.getWorkspaces(ctx.userId);
  }

  async switchActiveGitHubAccount(ctx: McpExecutionContext, accountId: string) {
    const updated = await this.gitHubService.switchActiveAccount(ctx.userId, accountId, ctx.meta);
    return {
      connected: updated.connected,
      activeAccountId: updated.activeAccountId ?? null,
      gitUsername: updated.gitUsername ?? null,
    };
  }

  async getGitHubActivity(
    ctx: McpExecutionContext,
    input: {
      since?: string;
      ownerType?: 'all' | 'personal' | 'organization';
      state?: 'all' | 'draft' | 'open' | 'merged' | 'closed' | 'direct_commits';
      repo?: string;
      includeCommits?: boolean;
    },
  ) {
    const activities = await this.gitHubService.fetchActivity(ctx.userId, input.since, ctx.meta);
    const filtered = filterActivities(activities, input);

    const includeCommits = input.includeCommits !== false;
    return {
      total: filtered.length,
      items: filtered.map((item) => ({
        repo: item.repo,
        ownerType: item.ownerType,
        number: item.number,
        title: item.title,
        prUrl: item.prUrl,
        state: item.state,
        activityType: item.activityType,
        headBranch: item.headBranch ?? null,
        baseBranch: item.baseBranch ?? null,
        labels: item.labels ?? [],
        updatedAt: item.updatedAt ?? null,
        commitCount: item.commits.length,
        ...(includeCommits ? { commits: item.commits } : {}),
      })),
    };
  }

  async resolvePullRequest(ctx: McpExecutionContext, ref: string) {
    return this.gitHubService.resolvePullRequest(ctx.userId, ref);
  }

  // ---------------------------------------------------------------------------
  // Task Groups (TrackingTask & TrackingTaskItem)
  // ---------------------------------------------------------------------------

  async listTaskGroups(
    ctx: McpExecutionContext,
    input: { includeCompleted?: boolean; search?: string },
  ) {
    const tasks = await this.tasksService.listTasks(ctx.userId);
    const includeCompleted = input.includeCompleted === true;
    const query = input.search?.trim().toLowerCase();

    const filtered = tasks.filter((task) => {
      if (!includeCompleted && task.isCompleted) {
        return false;
      }
      if (query) {
        const titleMatches = task.title.toLowerCase().includes(query);
        const itemMatches = task.items.some(
          (item) =>
            item.repo.toLowerCase().includes(query) || item.title.toLowerCase().includes(query),
        );
        return titleMatches || itemMatches;
      }
      return true;
    });

    return {
      total: filtered.length,
      tasks: filtered,
    };
  }

  async createTaskGroup(ctx: McpExecutionContext, input: CreateTaskGroupInput) {
    const resolvedItems = await this.resolveTaskItems(ctx.userId, input.prRefs, input.items);
    return this.tasksService.createTask(ctx.userId, {
      title: input.title,
      color: input.color,
      items: resolvedItems,
    });
  }

  async batchCreateTaskGroups(ctx: McpExecutionContext, groups: CreateTaskGroupInput[]) {
    if (groups.length === 0) {
      throw new BadRequestException('Danh sách nhóm task không được để trống.');
    }
    if (groups.length > 10) {
      throw new BadRequestException('Tối đa tạo 10 nhóm task mỗi lần gọi.');
    }

    const created = [];
    for (const group of groups) {
      const task = await this.createTaskGroup(ctx, group);
      created.push(task);
    }
    return {
      createdCount: created.length,
      tasks: created,
    };
  }

  async updateTaskGroup(
    ctx: McpExecutionContext,
    input: { taskId: string; title?: string; color?: TaskColor; isCompleted?: boolean },
  ) {
    return this.tasksService.updateTask(ctx.userId, input.taskId, {
      title: input.title,
      color: input.color,
      isCompleted: input.isCompleted,
    });
  }

  async deleteTaskGroup(ctx: McpExecutionContext, taskId: string) {
    return this.tasksService.deleteTask(ctx.userId, taskId);
  }

  async addPrsToTaskGroup(
    ctx: McpExecutionContext,
    input: { taskId: string; prRefs?: string[]; items?: McpTaskItemInput[] },
  ) {
    const resolvedItems = await this.resolveTaskItems(ctx.userId, input.prRefs, input.items);
    if (resolvedItems.length === 0) {
      throw new BadRequestException('Cần truyền ít nhất một PR qua prRefs hoặc items.');
    }
    return this.tasksService.addItems(ctx.userId, input.taskId, resolvedItems);
  }

  async removePrFromTaskGroup(
    ctx: McpExecutionContext,
    input: { taskId: string; repo: string; prNumber: number },
  ) {
    return this.tasksService.removeItem(ctx.userId, input.taskId, input.repo, input.prNumber);
  }

  async syncTaskPrStates(ctx: McpExecutionContext) {
    const tasks = await this.tasksService.syncTaskItemStates(ctx.userId);
    return { total: tasks.length, tasks };
  }

  // ---------------------------------------------------------------------------
  // AI Summarization & Report History
  // ---------------------------------------------------------------------------

  async listAiConnections(ctx: McpExecutionContext) {
    const connections = await this.aiService.listConnections(ctx.userId);
    return connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      label: conn.label,
      status: conn.status,
      availableModels: conn.availableModels,
      expiresAt: conn.expiresAt,
      lastVerifiedAt: conn.lastVerifiedAt,
    }));
  }

  async checkAiAvailability(
    ctx: McpExecutionContext,
    input: { engine?: 'GOOGLE_GEMINI' | 'GROQ'; connectionId?: string; model?: string },
  ) {
    const resolved = await this.aiService.resolveActiveAiEngine(
      ctx.userId,
      input.engine,
      input.connectionId,
    );
    return this.aiService.checkAvailability(
      ctx.userId,
      {
        engine: input.engine ?? resolved.engine,
        connectionId: input.connectionId ?? resolved.connectionId,
        model: input.model ?? resolved.model,
      },
      ctx.meta,
    );
  }

  async summarizePrsAi(ctx: McpExecutionContext, input: SummarizePrsAiInput) {
    const prsForSummary = await this.buildPrItemsForSummary(ctx, input);
    if (prsForSummary.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy PR hoặc commit phù hợp để tóm tắt từ nguồn đã chọn.',
      );
    }

    const resolvedEngine = await this.aiService.resolveActiveAiEngine(
      ctx.userId,
      input.engine as ValidAiEngine | undefined,
      input.connectionId,
    );

    const userSettings = await this.settingsService.getSettings(ctx.userId);
    const result = await this.aiService.summarize(
      ctx.userId,
      {
        prs: prsForSummary,
        engine: resolvedEngine.engine,
        connectionId: resolvedEngine.connectionId,
        model: input.model?.trim() || resolvedEngine.model,
        tone: input.tone,
        language: input.language || userSettings.language,
        customPrompt: input.customPrompt,
      },
      ctx.meta,
      { saveToHistory: input.saveToHistory !== false },
    );

    return {
      ...result,
      prCount: prsForSummary.length,
      commitCount: prsForSummary.reduce((sum, pr) => sum + pr.commits.length, 0),
    };
  }

  async saveReport(ctx: McpExecutionContext, input: SaveReportInput) {
    const bullets =
      input.bullets && input.bullets.length > 0
        ? input.bullets.map((b) => b.trim()).filter((b) => b.length > 0)
        : input.summaryText
          ? parseStandupBullets(input.summaryText)
          : [];

    if (bullets.length === 0) {
      throw new BadRequestException('Cần truyền bullets hoặc summaryText để lưu báo cáo.');
    }

    let prs = input.prs ?? [];
    if (prs.length === 0 && input.taskIds && input.taskIds.length > 0) {
      const tasks = await this.tasksService.listTasks(ctx.userId);
      const targetIds = new Set(input.taskIds);
      prs = tasks
        .filter((task) => targetIds.has(task.id))
        .flatMap((task) =>
          task.items.map((item) => ({
            repo: item.repo,
            title: `[${task.title}] ${item.title} (#${item.prNumber})`,
            commits: [] as string[],
          })),
        );
    }

    const parsedStart = input.dateRangeStart ? new Date(input.dateRangeStart) : undefined;
    const parsedEnd = input.dateRangeEnd ? new Date(input.dateRangeEnd) : undefined;
    if (parsedStart && Number.isNaN(parsedStart.getTime())) {
      throw new BadRequestException('dateRangeStart không đúng định dạng ISO 8601.');
    }
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      throw new BadRequestException('dateRangeEnd không đúng định dạng ISO 8601.');
    }

    const report = await this.reportsService.createExternalReport(ctx.userId, {
      bullets,
      prs,
      modelName: input.modelName,
      dateRangeStart: parsedStart,
      dateRangeEnd: parsedEnd,
      taskIds: input.taskIds,
    });

    await this.gitHubService.recordAuditLog(
      ctx.userId,
      'MCP_REPORT_SAVE',
      'SUCCESS',
      `Saved external MCP report ${report.id} (${bullets.length} bullets)`,
      ctx.meta,
    );

    return {
      reportId: report.id,
      bullets,
      summaryText: report.summaryText,
      prCount: report.prCount,
      commitCount: report.commitCount,
      aiEngineUsed: report.aiEngineUsed,
      modelName: report.modelName,
      createdAt: report.createdAt,
    };
  }

  async listReports(ctx: McpExecutionContext, limit = 10) {
    const reports = await this.reportsService.listReports(ctx.userId);
    const clamped = Math.max(1, Math.min(limit, 50));
    return {
      total: Math.min(reports.length, clamped),
      reports: reports.slice(0, clamped),
    };
  }

  async getReport(ctx: McpExecutionContext, reportId: string) {
    return this.reportsService.getReportById(ctx.userId, reportId);
  }

  async deleteReport(ctx: McpExecutionContext, reportId: string) {
    return this.reportsService.deleteReport(ctx.userId, reportId);
  }

  // ---------------------------------------------------------------------------
  // User Settings & Parabol Standup
  // ---------------------------------------------------------------------------

  async getUserSettings(ctx: McpExecutionContext) {
    return this.settingsService.getSettings(ctx.userId);
  }

  async updateUserSettings(ctx: McpExecutionContext, dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(ctx.userId, dto);
  }

  async listParabolConnections(ctx: McpExecutionContext) {
    const connections = await this.parabolService.listConnections(ctx.userId);
    return connections.map((conn) => ({
      id: conn.id,
      label: conn.label,
      parabolName: conn.parabolName,
      parabolEmail: conn.parabolEmail,
      status: conn.status,
      isActive: conn.isActive,
      expiresAt: conn.expiresAt,
      lastUsedAt: conn.lastUsedAt,
    }));
  }

  async switchActiveParabolConnection(ctx: McpExecutionContext, connectionId: string) {
    const connections = await this.parabolService.switchActiveConnection(
      ctx.userId,
      connectionId,
      ctx.meta,
    );
    const active =
      connections.find((c) => c.id === connectionId) ?? connections.find((c) => c.isActive);
    return {
      activeConnectionId: active?.id ?? connectionId,
      label: active?.label ?? null,
      connections: connections.map((c) => ({
        id: c.id,
        label: c.label,
        isActive: c.isActive,
        status: c.status,
      })),
    };
  }

  async listParabolStandups(
    ctx: McpExecutionContext,
    input: { connectionId?: string; meetingUrl?: string; refresh?: boolean },
  ) {
    const result = await this.parabolService.listActiveStandups(
      ctx.userId,
      {
        connectionId: input.connectionId,
        meetingUrl: input.meetingUrl,
        forceRefresh: input.refresh === true,
      },
      ctx.meta,
    );

    return {
      connected: result.connected,
      connection: result.connection
        ? {
            id: result.connection.id,
            label: result.connection.label,
            parabolName: result.connection.parabolName,
            isActive: result.connection.isActive,
          }
        : null,
      meetings: result.meetings,
    };
  }

  async submitParabolStandup(ctx: McpExecutionContext, input: SubmitParabolInput) {
    let bullets = (input.bullets ?? []).map((b) => b.trim()).filter((b) => b.length > 0);
    if (bullets.length === 0 && input.reportId) {
      const report = await this.reportsService.getReportById(ctx.userId, input.reportId);
      bullets = parseStandupBullets(report.summaryText);
    }

    if (bullets.length === 0) {
      throw new BadRequestException(
        'Cần truyền bullets hoặc reportId hợp lệ để gửi báo cáo lên Parabol.',
      );
    }

    return this.parabolService.submitStandup(
      ctx.userId,
      {
        connectionId: input.connectionId,
        meetingId: input.meetingId,
        promptId: input.promptId,
        bullets,
        shareImmediately: input.shareImmediately ?? false,
        includeTodayHeader: input.includeTodayHeader ?? true,
      },
      ctx.meta,
    );
  }

  // ---------------------------------------------------------------------------
  // Private Resolution Helpers
  // ---------------------------------------------------------------------------

  /** Resolves a list of PR URLs or owner/repo#number strings in bounded concurrent batches. */
  private async resolvePullRequestsInBatches(
    userId: string,
    refs: readonly string[],
  ): Promise<PrActivity[]> {
    const resolved: PrActivity[] = [];
    for (let i = 0; i < refs.length; i += RESOLVE_CONCURRENCY) {
      const batch = refs.slice(i, i + RESOLVE_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((ref) => this.gitHubService.resolvePullRequest(userId, ref)),
      );
      resolved.push(...batchResults);
    }
    return resolved;
  }

  private async resolveTaskItems(
    userId: string,
    prRefs?: readonly string[],
    rawItems?: readonly McpTaskItemInput[],
  ): Promise<TaskItemInputDto[]> {
    const resolvedMap = new Map<string, TaskItemInputDto>();

    for (const item of rawItems ?? []) {
      const key = normalizeLookupKey(item.repo, item.prNumber);
      resolvedMap.set(key, {
        repo: item.repo.trim(),
        prNumber: item.prNumber,
        title: item.title.trim(),
        prUrl: item.prUrl.trim(),
        state: item.state,
        ownerType: item.ownerType,
      });
    }

    const refsToResolve: string[] = [];
    for (const ref of prRefs ?? []) {
      const trimmed = ref.trim();
      if (!trimmed) continue;
      const parsed = parsePullRequestRef(trimmed);
      if (!parsed) {
        throw new BadRequestException(
          `Định dạng PR không hợp lệ: "${trimmed}". Dùng URL GitHub PR hoặc owner/repo#number.`,
        );
      }
      const key = normalizeLookupKey(`${parsed.owner}/${parsed.repo}`, parsed.number);
      if (!resolvedMap.has(key)) {
        refsToResolve.push(trimmed);
      }
    }

    if (refsToResolve.length > MAX_PR_REFS_PER_CALL) {
      throw new BadRequestException(
        `Tối đa xử lý ${MAX_PR_REFS_PER_CALL} PR references mỗi lần gọi.`,
      );
    }

    const resolvedActivities = await this.resolvePullRequestsInBatches(userId, refsToResolve);
    for (const activity of resolvedActivities) {
      const item = toTaskItemInput(activity);
      resolvedMap.set(normalizeLookupKey(item.repo, item.prNumber), item);
    }

    return Array.from(resolvedMap.values());
  }

  private async buildPrItemsForSummary(
    ctx: McpExecutionContext,
    input: SummarizePrsAiInput,
  ): Promise<PrItemDto[]> {
    if (input.prs && input.prs.length > 0) {
      return input.prs.filter((pr) => pr.commits && pr.commits.some((c) => c.trim().length > 0));
    }

    const targetTaskIds = [
      ...(input.taskId ? [input.taskId] : []),
      ...(input.taskIds ?? []),
    ].filter((id) => id.trim().length > 0);

    if (targetTaskIds.length > 0) {
      return this.buildPrItemsFromTasks(ctx, targetTaskIds, input.groupByTask !== false);
    }

    if (input.prRefs && input.prRefs.length > 0) {
      if (input.prRefs.length > MAX_PR_REFS_PER_CALL) {
        throw new BadRequestException(
          `Tối đa xử lý ${MAX_PR_REFS_PER_CALL} PR references mỗi lần tóm tắt.`,
        );
      }
      const resolved = await this.resolvePullRequestsInBatches(ctx.userId, input.prRefs);
      return resolved.map((activity) => ({
        repo: activity.repo,
        title: `${activity.title} (#${activity.number})`,
        commits:
          activity.commits.length > 0
            ? activity.commits
            : [activity.title || `PR #${activity.number}`],
      }));
    }

    const activities = await this.gitHubService.fetchActivity(ctx.userId, input.since, ctx.meta);
    return filterActivities(activities, input)
      .filter((item) => item.commits.length > 0)
      .map((item) => ({
        repo: item.repo,
        title: item.number > 0 ? `${item.title} (#${item.number})` : item.title,
        commits: item.commits,
      }));
  }

  private async buildPrItemsFromTasks(
    ctx: McpExecutionContext,
    taskIds: string[],
    groupByTask: boolean,
  ): Promise<PrItemDto[]> {
    const allTasks = await this.tasksService.listTasks(ctx.userId);
    const wantedIds = new Set(taskIds);
    const matchedTasks = allTasks.filter((task) => wantedIds.has(task.id));
    if (matchedTasks.length === 0) {
      throw new BadRequestException('Không tìm thấy Task nào khớp với taskId/taskIds đã chọn.');
    }

    const activityByKey = new Map<string, PrActivity>();
    try {
      const recent = await this.gitHubService.fetchActivity(ctx.userId, undefined, ctx.meta);
      for (const act of recent) {
        activityByKey.set(normalizeLookupKey(act.repo, act.number), act);
      }
    } catch {
      // Fallback to direct PR commit fetch per task item below
    }

    const prItems: PrItemDto[] = [];
    for (const task of matchedTasks) {
      for (let i = 0; i < task.items.length; i += RESOLVE_CONCURRENCY) {
        const batch = task.items.slice(i, i + RESOLVE_CONCURRENCY);
        const batchItems = await Promise.all(
          batch.map(async (item) => {
            const key = normalizeLookupKey(item.repo, item.prNumber);
            const matchedAct = activityByKey.get(key);
            let commits = matchedAct?.commits ?? [];
            if (commits.length === 0 && item.prNumber > 0) {
              commits = await this.gitHubService.fetchPullRequestCommits(
                ctx.userId,
                item.repo,
                item.prNumber,
              );
            }
            if (commits.length === 0) {
              commits = [`${item.title} (${item.repo}#${item.prNumber})`];
            }
            const labelPrefix = groupByTask ? `[Task: ${task.title}] ` : '';
            return {
              repo: item.repo,
              title: `${labelPrefix}${item.title} (#${item.prNumber})`,
              commits,
            };
          }),
        );
        prItems.push(...batchItems);
      }
    }

    return prItems;
  }
}
