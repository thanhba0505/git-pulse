const GITHUB_TOKEN_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36,}/g, // GitHub Personal Access Token (classic)
  /github_pat_[a-zA-Z0-9_]{82}/g, // GitHub Fine-Grained Personal Access Token
  /gho_[a-zA-Z0-9]{36,}/g, // GitHub OAuth Access Token
  /ghu_[a-zA-Z0-9]{36,}/g, // GitHub User-to-Server Token
  /ghs_[a-zA-Z0-9]{36,}/g, // GitHub Server-to-Server Token
  /ghr_[a-zA-Z0-9]{36,}/g, // GitHub Refresh Token
];

/**
 * Sanitizes any string or JSON representation by replacing any detected GitHub token
 * with a safe redacted placeholder '[REDACTED_GITHUB_TOKEN]' to prevent leaks in logs.
 */
export function redactTokens(input: unknown): string {
  if (input === null || input === undefined) {
    return "";
  }

  let text: string;
  if (typeof input === "string") {
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
    sanitized = sanitized.replace(pattern, "[REDACTED_GITHUB_TOKEN]");
  }

  return sanitized;
}
