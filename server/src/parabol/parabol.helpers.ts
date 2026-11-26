export const DEFAULT_PARABOL_BASE_URL = 'https://action.parabol.co';

export interface ParabolGraphqlErrorEntry {
  message?: string;
  path?: ReadonlyArray<string | number>;
  extensions?: {
    code?: string;
  };
}

export interface ClassifiedParabolError {
  statusCode: number;
  code: string;
  message: string;
  revokeToken: boolean;
}

interface TipTapTextNode {
  type: 'text';
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
}

interface TipTapParagraphNode {
  type: 'paragraph';
  content: TipTapTextNode[];
}

interface TipTapDocument {
  type: 'doc';
  content: TipTapParagraphNode[];
}

const MEETING_URL_PATH_REGEX = /\/meet\/([^/?#]+)/i;
const SAFE_MEETING_ID_REGEX = /^[a-zA-Z0-9:_-]{2,128}$/;
const INLINE_MARKDOWN_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

export function resolveParabolBaseUrl(): string {
  const configured = process.env.PARABOL_BASE_URL?.trim();
  if (!configured) {
    return DEFAULT_PARABOL_BASE_URL;
  }
  return configured.replace(/\/+$/, '');
}

export function resolveParabolGraphqlUrl(): string {
  return `${resolveParabolBaseUrl()}/graphql`;
}

export function buildParabolMeetingUrl(meetingId: string): string {
  return `${resolveParabolBaseUrl()}/meet/${encodeURIComponent(meetingId)}`;
}

export function normalizeParabolToken(rawToken: string): string {
  return rawToken
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

export function maskParabolToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return '••••';
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function parseParabolMeetingId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const match = parsed.pathname.match(MEETING_URL_PATH_REGEX);
      if (match?.[1] && SAFE_MEETING_ID_REGEX.test(match[1])) {
        return match[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  return SAFE_MEETING_ID_REGEX.test(trimmed) ? trimmed : null;
}

function parseInlineNodes(text: string): TipTapTextNode[] {
  const nodes: TipTapTextNode[] = [];
  let cursor = 0;
  INLINE_MARKDOWN_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_MARKDOWN_REGEX.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: 'text', text: text.slice(cursor, match.index) });
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      nodes.push({
        type: 'text',
        text: match[1],
        marks: [{ type: 'link', attrs: { href: match[2] } }],
      });
    } else if (match[3] !== undefined) {
      nodes.push({
        type: 'text',
        text: match[3],
        marks: [{ type: 'bold' }],
      });
    } else if (match[4] !== undefined) {
      nodes.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'code' }],
      });
    }

    cursor = INLINE_MARKDOWN_REGEX.lastIndex;
  }

  if (cursor < text.length) {
    nodes.push({ type: 'text', text: text.slice(cursor) });
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text: '' }];
}

const SECTION_HEADER_REGEX = /^[^•*-].{0,40}:$/;

/**
 * Serializes standup lines into Parabol's native TipTap JSONContent string.
 * Preserves section headers (such as "Today:") and normalizes bullet lines.
 */
export function buildParabolTipTapContent(
  bullets: readonly string[],
  options?: { includeTodayHeader?: boolean },
): string {
  const lines = bullets.map((line) => line.trim()).filter((line) => line.length > 0);
  const hasExplicitTodayHeader = lines.some((line) => /^today:?$/i.test(line));

  const paragraphs: TipTapParagraphNode[] = [];

  if (options?.includeTodayHeader && !hasExplicitTodayHeader && lines.length > 0) {
    paragraphs.push({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Today:', marks: [{ type: 'bold' }] }],
    });
  }

  for (const line of lines) {
    if (SECTION_HEADER_REGEX.test(line) && !/^[-*•]\s*/.test(line)) {
      paragraphs.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line, marks: [{ type: 'bold' }] }],
      });
      continue;
    }

    const body = line.replace(/^[-*•]\s*/, '').trim();
    if (!body) continue;
    paragraphs.push({
      type: 'paragraph',
      content: parseInlineNodes(`• ${body}`),
    });
  }

  if (paragraphs.length === 0) {
    paragraphs.push({
      type: 'paragraph',
      content: [{ type: 'text', text: '' }],
    });
  }

  const doc: TipTapDocument = {
    type: 'doc',
    content: paragraphs,
  };

  return JSON.stringify(doc);
}

export function classifyParabolError(
  httpStatus?: number,
  graphqlErrors?: readonly ParabolGraphqlErrorEntry[],
  retryAfterHeader?: string | null,
): ClassifiedParabolError {
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      statusCode: 401,
      code: 'PARABOL_AUTH_FAILED',
      message:
        'Parabol API rejected your Personal Access Token. Please verify it is active and has USERS_READ, TEAMS_READ, MEETINGS_READ, and MEETINGS_WRITE scopes.',
      revokeToken: true,
    };
  }

  if (httpStatus === 429) {
    const parsedRetry = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
    const waitHint =
      Number.isFinite(parsedRetry) && parsedRetry > 0
        ? ` Please wait ${parsedRetry}s before retrying.`
        : ' Free Parabol accounts have lower rate limits — please wait a moment and try again.';
    return {
      statusCode: 429,
      code: 'PARABOL_RATE_LIMITED',
      message: `Parabol API rate limit reached (HTTP 429).${waitHint}`,
      revokeToken: false,
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      statusCode: 502,
      code: 'PARABOL_UPSTREAM_ERROR',
      message: `Parabol API is temporarily unavailable (HTTP ${httpStatus}).`,
      revokeToken: false,
    };
  }

  const codes = (graphqlErrors ?? []).map((err) => err.extensions?.code ?? '').filter(Boolean);
  const joined = (graphqlErrors ?? [])
    .map((err) => err.message ?? '')
    .filter(Boolean)
    .join('; ');

  const lower = joined.toLowerCase();
  if (lower.includes('persistedqueryonly') || codes.includes('CANNOT_SEND_PQ_ID_AND_BODY')) {
    return {
      statusCode: 400,
      code: 'PARABOL_INVALID_TOKEN_FORMAT',
      message:
        'Invalid Parabol token format. Personal Access Tokens created at action.parabol.co/me/profile start with "pat_".',
      revokeToken: false,
    };
  }

  if (
    codes.includes('UNAUTHENTICATED') ||
    lower.includes('invalid or revoked personal access token')
  ) {
    return {
      statusCode: 401,
      code: 'PARABOL_AUTH_FAILED',
      message:
        'Parabol API rejected your Personal Access Token. Please verify it is active and has USERS_READ, TEAMS_READ, MEETINGS_READ, and MEETINGS_WRITE scopes.',
      revokeToken: true,
    };
  }

  if (lower.includes('scope') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return {
      statusCode: 403,
      code: 'PARABOL_MISSING_SCOPE',
      message: `Parabol API permission denied: ${joined || 'missing required token scope'}.`,
      revokeToken: false,
    };
  }

  if (lower.includes('not found')) {
    return {
      statusCode: 404,
      code: 'PARABOL_NOT_FOUND',
      message: joined || 'Parabol meeting or prompt not found.',
      revokeToken: false,
    };
  }

  return {
    statusCode: 400,
    code: 'PARABOL_GRAPHQL_ERROR',
    message:
      joined || (httpStatus ? `Parabol API error (HTTP ${httpStatus})` : 'Parabol API error'),
    revokeToken: false,
  };
}
