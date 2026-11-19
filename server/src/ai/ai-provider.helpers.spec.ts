import {
  buildStandupPrompts,
  filterAndNormalizeGitHubCatalogModels,
  filterAndSortGeminiModels,
  isJsonContentType,
  mapGitHubModelId,
  maskApiKey,
  parseStandupBullets,
} from './ai-provider.helpers';

describe('ai-provider.helpers', () => {
  it('masks API keys preserving only first 4 and last 4 characters', () => {
    expect(maskApiKey('AIzaSyB1234567890abcdefXYZ9')).toBe('AIza••••XYZ9');
    expect(maskApiKey('short')).toBe('••••');
  });

  it('normalizes legacy GitHub Models IDs to publisher/model format', () => {
    expect(mapGitHubModelId('gpt-4o-mini')).toBe('openai/gpt-4o-mini');
    expect(mapGitHubModelId('meta-llama-3.3-70b-instruct')).toBe('meta/llama-3.3-70b-instruct');
    expect(mapGitHubModelId('openai/gpt-4.1')).toBe('openai/gpt-4.1');
  });

  it('detects JSON content-type and rejects plain text retirement stubs', () => {
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true);
    expect(isJsonContentType('text/plain')).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });

  it('filters out embeddings/imagen/audio and prioritizes flagship Gemini chat models', () => {
    const models = filterAndSortGeminiModels([
      {
        name: 'models/gemini-embedding-001',
        displayName: 'Gemini Embedding',
        supportedGenerationMethods: ['embedContent'],
      },
      {
        name: 'models/imagen-3.0-generate-002',
        displayName: 'Imagen 3',
        supportedGenerationMethods: ['predict'],
      },
      {
        name: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        supportedGenerationMethods: ['generateContent'],
      },
      {
        name: 'models/gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        supportedGenerationMethods: ['generateContent'],
      },
      {
        name: 'models/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        supportedGenerationMethods: ['generateContent'],
      },
      {
        name: 'models/gemini-2.5-flash-tts',
        displayName: 'Gemini 2.5 Flash TTS',
        supportedGenerationMethods: ['generateContent'],
      },
    ]);

    expect(models.map((m) => m.id)).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
    ]);
  });

  it('builds consistent standup prompts and strips bullet prefixes cleanly', () => {
    const { systemPrompt, userPrompt } = buildStandupPrompts(
      [{ repo: 'org/repo', title: 'feat: add vault', commits: ['add schema'] }],
      'en',
    );
    expect(systemPrompt).toContain('English');
    expect(userPrompt).toContain('Repository: org/repo');

    expect(parseStandupBullets('• First item\n- Second item\n* Third item')).toEqual([
      'First item',
      'Second item',
      'Third item',
    ]);
  });

  it('filters GitHub catalog entries to text chat models cleanly', () => {
    const models = filterAndNormalizeGitHubCatalogModels([
      {
        id: 'openai/text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        task: 'embeddings',
      },
      {
        id: 'openai/gpt-4o-mini',
        friendly_name: 'OpenAI GPT-4o mini',
        publisher: 'OpenAI',
        task: 'chat-completion',
        supported_output_modalities: ['text'],
      },
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        summary: 'Reasoning model',
      },
    ]);

    expect(models).toEqual([
      {
        id: 'openai/gpt-4o-mini',
        label: 'OpenAI GPT-4o mini',
        description: 'OpenAI',
      },
      {
        id: 'deepseek/deepseek-r1',
        label: 'DeepSeek R1',
        description: 'Reasoning model',
      },
    ]);
  });
});
