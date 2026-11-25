const GITHUB_TOKEN_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36,}/g, // GitHub Personal Access Token (classic)
  /github_pat_[a-zA-Z0-9_]{82}/g, // GitHub Fine-Grained Personal Access Token
  /gho_[a-zA-Z0-9]{36,}/g, // GitHub OAuth Access Token
  /ghu_[a-zA-Z0-9]{36,}/g, // GitHub User-to-Server Token
  /ghs_[a-zA-Z0-9]{36,}/g, // GitHub Server-to-Server Token
  /ghr_[a-zA-Z0-9]{36,}/g, // GitHub Refresh Token
];

const AI_KEY_PATTERNS = [
  /AIza[0-9A-Za-z_-]{35}/g, // Google Gemini / Google AI Studio API Key
  /AQ\.[0-9A-Za-z_-]{25,}/g, // Google AI Studio / Vertex Express AQ. API Key
  /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic API Key
  /sk-or-[a-zA-Z0-9_-]{20,}/g, // OpenRouter API Key
  /sk-[a-zA-Z0-9_-]{20,}/g, // OpenAI / compatible API Key
  /gsk_[a-zA-Z0-9]{20,}/g, // Groq API Key
];

const BEARER_TOKEN_PATTERN = /\bBearer\s+(?!\[REDACTED_)[A-Za-z0-9._~+/=-]{16,}/gi;
const PARABOL_PAT_PATTERNS = [/\bpbl_[A-Za-z0-9_-]{16,}/g, /\bpat_[A-Za-z0-9_-]{16,}/g];

/**
 * Sanitizes any string or JSON representation by replacing detected GitHub tokens,
 * AI provider keys, and Parabol / Bearer credentials with safe placeholders.
 */
export function redactTokens(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  let text: string;
  if (typeof input === 'string') {
    text = input;
  } else {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  }

  let sanitized = text;
  for (const pattern of GITHUB_TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_GITHUB_TOKEN]');
  }
  for (const pattern of AI_KEY_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_AI_KEY]');
  }
  for (const pattern of PARABOL_PAT_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_PARABOL_TOKEN]');
  }
  sanitized = sanitized.replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED_TOKEN]');

  return sanitized;
}
