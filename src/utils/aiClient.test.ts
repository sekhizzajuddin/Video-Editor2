import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeStoryboardWithGemini, refineAudioQueryWithGroq } from './aiClient';

describe('aiClient tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

      const result = await analyzeStoryboardWithGemini('base64String', 10, 'mockKey');
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

      const result = await analyzeStoryboardWithGemini('base64String', 10, 'mockKey');
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
        analyzeStoryboardWithGemini('base64String', 10, 'mockKey')
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
                content: 'ocean waves shoreline splash'
              }
            }
          ]
        })
      });
      vi.stubGlobal('fetch', globalFetchMock);

      const result = await refineAudioQueryWithGroq('ocean waves crashing on sand', 'mockKey');
      expect(result).toBe('ocean waves shoreline splash');

      const expectedPayload = {
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a search query optimizer. Return ONLY the requested tags/keywords separated by space. Do not write any conversational text, explanations, or quotes.'
          },
          {
            role: 'user',
            content: 'You are a search query optimizer for audio assets.\nGiven this sound design description: "ocean waves crashing on sand", return 3-5 optimized tags/keywords for searching sound effects on Freesound.org.\nFor example, "ocean waves crashing on sand" should become "waves ocean seashore water splash".\nReturn ONLY the optimized keywords separated by spaces. Do NOT include any explanations, markdown, or headers.'
          }
        ],
        temperature: 0.1
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
        refineAudioQueryWithGroq(originalQuery, 'mockKey')
      ).rejects.toThrow('Groq API error: 401 - Unauthorized');
    });
  });
});
