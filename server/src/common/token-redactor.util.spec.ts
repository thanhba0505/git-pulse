import { redactTokens } from './token-redactor.util';

describe('token-redactor.util', () => {
  it('should redact classic ghp_ tokens', () => {
    const raw = 'Error occurred with token ghp_1234567890abcdef1234567890abcdef1234 while fetching';
    const redacted = redactTokens(raw);
    expect(redacted).toBe('Error occurred with token [REDACTED_GITHUB_TOKEN] while fetching');
  });

  it('should redact fine-grained github_pat_ tokens', () => {
    const rawPat = 'github_pat_' + 'a'.repeat(82);
    const raw = `Authorization: Bearer ${rawPat}`;
    const redacted = redactTokens(raw);
    expect(redacted).toBe('Authorization: Bearer [REDACTED_GITHUB_TOKEN]');
  });

  it('should redact gho_ OAuth tokens', () => {
    const raw = 'OAuth returned token: gho_1234567890abcdef1234567890abcdef1234';
    const redacted = redactTokens(raw);
    expect(redacted).toBe('OAuth returned token: [REDACTED_GITHUB_TOKEN]');
  });

  it('should sanitize nested JSON objects without mutating original', () => {
    const obj = {
      user: 'dev',
      secret: 'ghp_1234567890abcdef1234567890abcdef1234',
    };
    const redacted = redactTokens(obj);
    expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(redacted).not.toContain('ghp_1234567890abcdef1234567890abcdef1234');
  });

  it('should redact Google Gemini API keys', () => {
    const syntheticGeminiKey = 'AIza' + 'B1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2';
    const raw = `Gemini request failed with key=${syntheticGeminiKey}`;
    const redacted = redactTokens(raw);
    expect(redacted).toBe('Gemini request failed with key=[REDACTED_AI_KEY]');
    expect(redacted).not.toContain(syntheticGeminiKey);

    const syntheticAqKey = 'AQ.' + 'Ab8TestKey1234567890abcdefghijklmnop';
    const aqRedacted = redactTokens(`Failed authenticating ${syntheticAqKey}.`);
    expect(aqRedacted).toBe('Failed authenticating [REDACTED_AI_KEY].');
    expect(aqRedacted).not.toContain(syntheticAqKey);
  });

  it('should redact Parabol and generic Bearer tokens without breaking GitHub Bearer redaction', () => {
    const rawParabol = 'Authorization: Bearer parabol_secret_token_1234567890abcdef';
    expect(redactTokens(rawParabol)).toBe('Authorization: Bearer [REDACTED_TOKEN]');
    expect(redactTokens('token pbl_1234567890abcdef1234')).toBe('token [REDACTED_PARABOL_TOKEN]');
  });

  it('should redact gp_mcp_ API keys standalone and inside Bearer headers', () => {
    const syntheticMcpKey = 'gp_mcp_' + 'AbCdEf1234567890_xyzXYZ123456';
    expect(redactTokens(`MCP key leaked: ${syntheticMcpKey}`)).toBe(
      'MCP key leaked: [REDACTED_MCP_TOKEN]',
    );
    expect(redactTokens(`Authorization: Bearer ${syntheticMcpKey}`)).toBe(
      'Authorization: Bearer [REDACTED_MCP_TOKEN]',
    );
  });
});
