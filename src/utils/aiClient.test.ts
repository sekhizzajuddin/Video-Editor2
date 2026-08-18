import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeStoryboardWithGemini, refineAudioQueryWithGroq, analyzeMotionGraphicsWithGemini } from './aiClient';

describe('aiClient tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // aiClient resolves API keys via fetchWithKeyFailover, which reads
    // import.meta.env first and falls back to sessionStorage (browser-only).
    // Stub both so the key-resolution path is deterministic in the Node test
    // environment and the mocked global fetch is actually reached.
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('VITE_GROQ_API_KEY', 'test-groq-key');
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });


  describe('analyzeStoryboardWithGemini', () => {
    it('successfully parses raw JSON responses from Gemini', async () => {
      const mockResult = [
        {
          start: 1.5,
          end: 3.5,
          query: 'waves crashing',
          type: 'sfx',
          reason: 'beach visual shown'
        }
      ];

      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify(mockResult) }
                ]
              }
            }
          ]
        })
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const result = await analyzeStoryboardWithGemini('base64String', 10);
      expect(result).toEqual(mockResult);
      expect(globalFetchMock).toHaveBeenCalledTimes(1);
    });

    it('successfully cleans and parses markdown-wrapped JSON arrays', async () => {
      const mockResult = [
        {
          start: 2,
          end: 5,
          query: 'car horn',
          type: 'sfx',
          reason: 'busy street visual'
        }
      ];

      const markdownResponse = `Here is your sound design:
\`\`\`json
${JSON.stringify(mockResult)}
\`\`\`
Hope this helps!`;

      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: markdownResponse }
                ]
              }
            }
          ]
        })
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const result = await analyzeStoryboardWithGemini('base64String', 10);
      expect(result).toEqual(mockResult);
    });

    it('throws error when response is not ok', async () => {
      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });
      vi.stubGlobal('fetch', globalFetchMock);

      await expect(
        analyzeStoryboardWithGemini('base64String', 10)
      ).rejects.toThrow('Gemini API error: 500 - Internal Server Error');
    });
  });

  describe('refineAudioQueryWithGroq', () => {
    it('successfully extracts space-separated tags from Groq chat completion response', async () => {
      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"keywords": "ocean waves shoreline splash", "alternatives": []}'
              }
            }
          ]
        })
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const result = await refineAudioQueryWithGroq('ocean waves crashing on sand');
      expect(result).toMatchObject({ keywords: 'ocean waves shoreline splash', alternatives: [] });

      const expectedPayload = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert audio library search optimizer for Freesound.org.\nYour ONLY job is to convert a sound description into a primary query (1-3 words) and 3 alternative queries.\n\nCRITICAL RULES FOR FREESOUND:\n1. Freesound uses exact text matching. Using long specific phrases will return ZERO results.\n2. You MUST use 1 to 3 broad, generic nouns/tags max per query (e.g., "city night", "rain").\n3. NEVER use full sentences or highly descriptive adjectives.\n\nSFX KEYWORDS:\n- Use 1 or 2 generic nouns for the physical sound.\n\nReturn ONLY valid JSON (no markdown):\n{\n  "keywords": "primary 1-3 words",\n  "alternatives": ["alt1", "alt2", "alt3"]\n}`
          },
          {
            role: 'user',
            content: 'Convert this sound effect/SFX description to Freesound.org search keywords:\n"ocean waves crashing on sand"'
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'refinement_schema',
            strict: false,
            schema: {
              type: 'object',
              properties: {
                keywords: { type: 'string' },
                alternatives: { type: 'array', items: { type: 'string' } }
              },
              required: ['keywords', 'alternatives']
            }
          }
        },
        temperature: 0.1,
        max_tokens: 150
      };

      const [calledUrl, calledOptions] = globalFetchMock.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(JSON.parse(calledOptions.body as string)).toEqual(expectedPayload);
    });

    it('falls back to original query if Groq API fails', async () => {
      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const originalQuery = 'crashing thunder storm';
      await expect(
        refineAudioQueryWithGroq(originalQuery)
      ).rejects.toThrow('Groq API error: 401 - Unauthorized');
    });
  });

  describe('analyzeMotionGraphicsWithGemini', () => {
    it('successfully recommendations templates from Gemini response', async () => {
      const mockSuggestions = [
        {
          templateId: 'lower_third_classic',
          start: 2,
          end: 6,
          suggestedText: 'Dr. Jane Doe\nNeuroscientist',
          reason: 'Jane is speaking on screen'
        }
      ];

      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify(mockSuggestions) }
                ]
              }
            }
          ]
        })
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const result = await analyzeMotionGraphicsWithGemini('base64String', 10);
      expect(result).toEqual(mockSuggestions);
      expect(globalFetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws error when Gemini API fails', async () => {
      const globalFetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      });
      vi.stubGlobal('fetch', globalFetchMock);

      await expect(
        analyzeMotionGraphicsWithGemini('base64String', 10)
      ).rejects.toThrow('Gemini API error: 400 - Bad Request');
    });
  });
});
