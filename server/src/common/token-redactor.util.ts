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
  /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic API Key
  /sk-or-[a-zA-Z0-9_-]{20,}/g, // OpenRouter API Key
  /sk-[a-zA-Z0-9_-]{20,}/g, // OpenAI / compatible API Key
  /gsk_[a-zA-Z0-9]{20,}/g, // Groq API Key
];

/**
 * Sanitizes any string or JSON representation by replacing detected GitHub tokens
 * and AI provider keys with safe placeholders to prevent leaks in logs or errors.
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

  return sanitized;
}
