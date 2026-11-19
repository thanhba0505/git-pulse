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
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Deep reasoning • Detailed',
  },
];

const EXCLUDED_GEMINI_KEYWORDS = [
  'embedding',
  'imagen',
  'veo',
  'tts',
  'audio',
  'robotics',
  'computer-use',
  'image',
  'live',
  'aqa',
  'bisheng',
  'tuning',
];

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

function extractGeminiSortScore(id: string): number {
  const versionMatch = id.match(/^gemini-(\d+)(?:\.(\d+))?/i);
  const major = versionMatch ? Number.parseInt(versionMatch[1] ?? '0', 10) : 0;
  const minor = versionMatch && versionMatch[2] ? Number.parseInt(versionMatch[2], 10) : 0;
  let score = major * 1000 + minor * 100;

  if (id.includes('flash') && !id.includes('lite')) score += 40;
  else if (id.includes('pro')) score += 30;
  else if (id.includes('flash-lite')) score += 20;

  if (!id.includes('exp') && !id.includes('preview')) score += 10;
  if (id.includes('latest')) score -= 5;
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

  filtered.sort((a, b) => extractGeminiSortScore(b.id) - extractGeminiSortScore(a.id));
  return filtered.slice(0, 15);
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

/**
 * Builds consistent system & user standup summarization prompts across all AI providers.
 */
export function buildStandupPrompts(
  prs: readonly PrItemDto[],
  language?: string,
  customPrompt?: string,
): { systemPrompt: string; userPrompt: string } {
  const lang = language === 'en' ? 'English' : 'Vietnamese';
  const prDetails = prs
    .map(
      (p) =>
        `Repository: ${p.repo}\nPR Title: ${p.title}\nCommits:\n` +
        p.commits.map((c) => `  - ${c}`).join('\n'),
    )
    .join('\n\n');

  const systemPrompt =
    customPrompt?.trim() ||
    `You are an expert tech lead summarizing daily developer progress for standup. ` +
      `Summarize the provided pull requests and commit titles into 3 to 4 concise bullet points in ${lang}. ` +
      `Group related work, emphasize actual features, bugfixes and outcomes, skip trivial docs or merge noise. ` +
      `Each bullet point MUST start with "• " or "- ", be under 20 words, and use clean, natural developer terminology without AI clichés. ` +
      `Return ONLY the bullet points, no preamble, title, or greeting.`;

  const userPrompt = `Pull Requests and Commits worked on today:\n\n${prDetails}`;
  return { systemPrompt, userPrompt };
}

/**
 * Splits raw AI output into clean standup bullet lines without leading markers.
 */
export function parseStandupBullets(rawContent: string): string[] {
  const lines = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-*•]\s*/, ''));

  return lines.length > 0 ? lines : ['Cập nhật và hoàn thiện các module hệ thống.'];
}
