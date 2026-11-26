import * as crypto from 'crypto';

export const MCP_SCOPES = [
  'read:activity',
  'write:activity',
  'read:tasks',
  'write:tasks',
  'ai:summarize',
  'read:reports',
  'write:reports',
  'read:settings',
  'write:settings',
  'write:parabol',
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const DEFAULT_MCP_SCOPES: readonly McpScope[] = [...MCP_SCOPES];

export const MCP_TOKEN_PREFIX = 'gp_mcp_';

/** Computes SHA-256 hex digest for storing and verifying MCP API keys without plaintext storage. */
export function hashMcpToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** Formats a safe display prefix for an MCP API key without leaking secret entropy. */
export function maskMcpToken(rawToken: string): string {
  const clean = rawToken.trim();
  if (clean.length <= 16) {
    return `${MCP_TOKEN_PREFIX}••••`;
  }
  return `${clean.slice(0, 11)}••••${clean.slice(-4)}`;
}
