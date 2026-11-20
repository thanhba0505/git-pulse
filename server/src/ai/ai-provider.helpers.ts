import { PrItemDto } from './dto/summarize.dto';

export const GITHUB_MODELS_CATALOG_URL = 'https://models.github.ai/catalog/models';
export const GITHUB_MODELS_INFERENCE_URL = 'https://models.github.ai/inference/chat/completions';
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface AiModelOption {
  id: string;
  label: string;
  description?: string;
}

export interface GeminiApiModelEntry {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export interface GitHubCatalogModelEntry {
  id?: string;
  name?: string;
  friendly_name?: string;
  publisher?: string;
  summary?: string;
  task?: string;
  supported_output_modalities?: string[];
}

export const DEFAULT_GITHUB_MODELS: readonly AiModelOption[] = [
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Fast • Standup optimized',
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B Instruct',
    description: 'Deep reasoning • Detailed',
  },
];

export const DEFAULT_GEMINI_MODELS: readonly AiModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Fast • Standup optimized',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    description: 'Lightweight • Fast Free Tier response',
  },
];

const EXCLUDED_GEMINI_KEYWORDS = [
  'embedding',
  'imagen',
  'veo',
  'tts',
  'audio',
  'transcribe',
  'customtools',
  'nano-banana',
  'robotics',
  'computer-use',
  'image',
  'live',
  'aqa',
  'bisheng',
  'tuning',
];

const GEMINI_CODENAME_RE = /\b(argon|carbon|hydrogen|neon)\b/i;

export interface GeminiClassifiedError {
  reasonCode:
    | 'INVALID_KEY'
    | 'MODEL_UNSUPPORTED'
    | 'MODEL_NOT_FOUND'
    | 'QUOTA_EXCEEDED'
    | 'SERVICE_UNAVAILABLE';
  reason: string;
  shouldRevoke: boolean;
}

const GITHUB_MODEL_ID_MAP: Record<string, string> = {
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gpt-4o': 'openai/gpt-4o',
  'meta-llama-3.3-70b-instruct': 'meta/llama-3.3-70b-instruct',
};

/**
 * Masks an API key so only safe prefix/suffix hints remain for UI display.
 */
export function maskApiKey(rawKey: string): string {
  const key = rawKey.trim();
  if (key.length <= 8) {
    return '••••';
  }
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/**
 * Normalizes legacy un-namespaced GitHub Models IDs to publisher/model-name format.
 */
export function mapGitHubModelId(model: string): string {
  const trimmed = model.trim();
  if (trimmed.includes('/')) {
    return trimmed;
  }
  return GITHUB_MODEL_ID_MAP[trimmed] || trimmed;
}

/**
 * Checks whether a Fetch Response advertises a JSON Content-Type header.
 */
export function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return contentType.toLowerCase().includes('application/json');
}

function extractGeminiSortScore(id: string, description?: string): number {
  const lowerId = id.toLowerCase();
  const lowerDesc = (description || '').trim().toLowerCase();
  const versionMatch = lowerId.match(/^gemini-(\d+)(?:\.(\d+))?/);
  const major = versionMatch ? Number.parseInt(versionMatch[1] ?? '0', 10) : 0;
  const minor = versionMatch && versionMatch[2] ? Number.parseInt(versionMatch[2], 10) : 0;

  const isPreviewOrExp = lowerId.includes('preview') || lowerId.includes('exp');
  const isLatestAlias = lowerId.includes('latest');
  const isCodename = major >= 4 && GEMINI_CODENAME_RE.test(lowerId);
  const isStableGa =
    !isPreviewOrExp &&
    !isLatestAlias &&
    !isCodename &&
    (lowerDesc.startsWith('stable') || (major >= 2 && major < 3));

  // Prioritize verified GA stable models before preview/experimental and tier-gated codenames
  let score = isStableGa ? 30000 : !isCodename && !lowerId.includes('omni') ? 20000 : 10000;
  score += major * 1000 + minor * 100;

  if (lowerId.includes('flash') && !lowerId.includes('lite')) score += 40;
  else if (lowerId.includes('flash-lite')) score += 35;
  else if (lowerId.includes('pro')) score += 30;

  if (!isPreviewOrExp) score += 10;
  if (isLatestAlias) score -= 5;
  return score;
}

/**
 * Filters and ranks Gemini models that support text/standup generation.
 */
export function filterAndSortGeminiModels(
  rawModels: readonly GeminiApiModelEntry[],
): AiModelOption[] {
  const seen = new Set<string>();
  const filtered: AiModelOption[] = [];

  for (const entry of rawModels) {
    const rawName = entry.name?.trim();
    if (!rawName) continue;

    const id = rawName.replace(/^models\//, '');
    const lowerId = id.toLowerCase();

    if (!lowerId.startsWith('gemini-')) continue;
    if (EXCLUDED_GEMINI_KEYWORDS.some((kw) => lowerId.includes(kw))) continue;

    const methods = entry.supportedGenerationMethods ?? [];
    if (methods.length > 0 && !methods.includes('generateContent')) continue;

    if (seen.has(id)) continue;
    seen.add(id);

    filtered.push({
      id,
      label: entry.displayName?.trim() || id,
      description: entry.description?.trim() ? entry.description.trim().slice(0, 90) : undefined,
    });
  }

  filtered.sort(
    (a, b) =>
      extractGeminiSortScore(b.id, b.description) - extractGeminiSortScore(a.id, a.description),
  );
  return filtered.slice(0, 30);
}

/**
 * Returns true if an error is an AbortController timeout error.
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') {
    return true;
  }
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Classifies Gemini API HTTP errors consistently for availability probes and summarization.
 */
export function classifyGeminiHttpError(
  model: string,
  status: number,
  safeMsg: string,
  errorStatus?: string,
): GeminiClassifiedError {
  const isInvalidKey =
    status === 401 ||
    status === 403 ||
    (status === 400 &&
      (errorStatus === 'API_KEY_INVALID' ||
        /api[ _-]?key.*(invalid|not valid|expired)/i.test(safeMsg)));

  if (isInvalidKey) {
    return {
      reasonCode: 'INVALID_KEY',
      reason: `API Key Google Gemini không hợp lệ hoặc đã bị thu hồi: ${safeMsg}`,
      shouldRevoke: true,
    };
  }

  if (status === 400) {
    return {
      reasonCode: 'MODEL_UNSUPPORTED',
      reason: `Mô hình ${model} không hỗ trợ yêu cầu hiện tại (400): ${safeMsg}`,
      shouldRevoke: false,
    };
  }

  if (status === 404) {
    return {
      reasonCode: 'MODEL_NOT_FOUND',
      reason: `Mô hình ${model} không tồn tại hoặc không còn cấp cho tài khoản này: ${safeMsg}`,
      shouldRevoke: false,
    };
  }

  if (status === 429) {
    const isQuotaZero = /limit:\s*0\b/i.test(safeMsg);
    return {
      reasonCode: 'QUOTA_EXCEEDED',
      reason: isQuotaZero
        ? `Mô hình ${model} có hạn mức miễn phí bằng 0 (Free Tier limit = 0). Vui lòng chọn dòng Flash / Flash-Lite (VD: gemini-2.5-flash) hoặc nâng cấp Billing.`
        : `API Key Google Gemini đã tạm chạm giới hạn tần suất (429 Rate Limit) trên ${model}. Vui lòng thử lại sau ít phút hoặc chọn mô hình khác.`,
      shouldRevoke: false,
    };
  }

  if (status >= 500) {
    return {
      reasonCode: 'SERVICE_UNAVAILABLE',
      reason: `Máy chủ Google Gemini đang quá tải hoặc tạm bảo trì trên ${model} (HTTP ${status}). Hãy thử lại hoặc chọn mô hình khác.`,
      shouldRevoke: false,
    };
  }

  return {
    reasonCode: 'SERVICE_UNAVAILABLE',
    reason: `Google Gemini trả về lỗi (${status}) trên ${model}: ${safeMsg}`,
    shouldRevoke: false,
  };
}

/**
 * Filters and normalizes a live GitHub Models catalog payload into AiModelOption[].
 */
export function filterAndNormalizeGitHubCatalogModels(
  rawList: readonly GitHubCatalogModelEntry[],
): AiModelOption[] {
  const seen = new Set<string>();
  const normalized: AiModelOption[] = [];

  for (const entry of rawList) {
    const id = (entry.id || entry.name || '').trim();
    if (!id) continue;

    const task = entry.task?.toLowerCase();
    if (task && (task.includes('embedding') || task.includes('image') || task.includes('audio'))) {
      continue;
    }

    const outputs = entry.supported_output_modalities;
    if (Array.isArray(outputs) && outputs.length > 0 && !outputs.includes('text')) {
      continue;
    }

    if (seen.has(id)) continue;
    seen.add(id);

    const label = entry.friendly_name?.trim() || entry.name?.trim() || id;
    const rawDesc = entry.summary?.trim() || entry.publisher?.trim();
    normalized.push({
      id,
      label,
      ...(rawDesc ? { description: rawDesc.slice(0, 90) } : {}),
    });
  }

  return normalized.slice(0, 20);
}

/**
 * Normalizes persisted availableModels JSON safely into typed AiModelOption[].
 */
export function normalizeStoredModels(raw: unknown): AiModelOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: AiModelOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.label !== 'string') continue;
    normalized.push({
      id: record.id,
      label: record.label,
      ...(typeof record.description === 'string' ? { description: record.description } : {}),
    });
  }
  return normalized;
}

export const DEFAULT_AI_PROMPT =
  `You are an expert tech lead summarizing daily developer commits.\n` +
  `Summarize the provided git commits into maximum 5 concise, high-impact bullet points in English.\n\n` +
  `Format strictly as:\n` +
  `Today:\n` +
  `• <Past-tense action verb> <direct summary of changes>\n\n` +
  `Rules:\n` +
  `- The first line must be exactly "Today:".\n` +
  `- Maximum 5 lines/bullet points, each starting with "• ".\n` +
  `- Each bullet must begin with a capitalized past-tense verb (e.g., Added, Configured, Documented, Restricted, Fixed, Refactored, Optimized).\n` +
  `- Focus strictly on commit messages; group related changes and omit chore or trivial noise.\n` +
  `- Do not output any preamble, greeting, markdown formatting, or trailing text.`;

/**
 * Builds consistent system & user commit-based report prompts across all AI providers.
 */
export function buildStandupPrompts(
  prs: readonly PrItemDto[],
  _language?: string,
  customPrompt?: string,
): { systemPrompt: string; userPrompt: string } {
  const commitsByRepo = new Map<string, Set<string>>();
  for (const item of prs) {
    const repo = item.repo.trim() || 'workspace';
    let bucket = commitsByRepo.get(repo);
    for (const rawCommit of item.commits ?? []) {
      const msg = rawCommit.trim();
      if (!msg) continue;
      if (!bucket) {
        bucket = new Set<string>();
        commitsByRepo.set(repo, bucket);
      }
      bucket.add(msg);
    }
  }

  const commitDetails = Array.from(commitsByRepo.entries())
    .map(
      ([repo, commits]) =>
        `Repository: ${repo}\nCommits:\n${Array.from(commits)
          .map((c) => `  - ${c}`)
          .join('\n')}`,
    )
    .join('\n\n');

  const trimmedCustom = customPrompt?.trim();
  const systemPrompt = trimmedCustom || DEFAULT_AI_PROMPT;
  const userPrompt = `Git commits to summarize:\n\n${commitDetails}`;
  return { systemPrompt, userPrompt };
}

/**
 * Splits raw AI output into clean standup bullet lines without leading markers or Today header.
 */
export function parseStandupBullets(rawContent: string): string[] {
  const lines = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^today:?$/i.test(line))
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);

  return lines.length > 0 ? lines : ['Completed scheduled development tasks.'];
}
