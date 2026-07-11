import { useEditorStore } from '@/store/editorStore';

export interface AudioOption {
  id: string;
  name: string;
  duration: number;
  previewUrl: string;
  tags: string[];
}

// Fallback public read-only token for Freesound API (can be overridden by user in UI settings)
export const DEFAULT_FREESOUND_TOKEN = 'V44W0kixpW9mD75yB8iR1e2D3h8P6Q8w';

/**
 * Searches Freesound.org for sound effects matching a given query.
 */
export async function searchFreesound(
  query: string,
  token?: string,
  type?: 'sfx' | 'bgm'
): Promise<AudioOption[]> {
  const envToken = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_FREESOUND_API_KEY : undefined;
  const actualToken = token || envToken || useEditorStore.getState().settings.freesoundApiKey || DEFAULT_FREESOUND_TOKEN;
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Use explicit type if provided; fallback to keyword-based heuristic
  const isBgm = type === 'bgm' || (!type && (query.toLowerCase().includes('music') || query.toLowerCase().includes('bgm') || query.toLowerCase().includes('ambient') || query.toLowerCase().includes('orchestral') || query.toLowerCase().includes('cinematic') || query.toLowerCase().includes('lofi') || query.toLowerCase().includes('electronic')));
  const durationFilter = isBgm ? 'duration:[10.0 TO 300.0]' : 'duration:[0.5 TO 15.0]';
  
  // Use our serverless function proxy to bypass CORS and properly handle Env vars
  const url = `/api/freesound?query=${encodeURIComponent(cleanQuery)}&token=${actualToken}&durationFilter=${encodeURIComponent(durationFilter)}&pageSize=5`;

  let response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Freesound API error: ${response.status} - ${errorText}`);
  }

  let data = await response.json();
  let results = data?.results || [];

  // Fallback: If 0 results, try an OR search (e.g., "city traffic" -> "city OR traffic")
  if (results.length === 0 && cleanQuery.includes(' ')) {
    const orQuery = cleanQuery.split(/\s+/).join(' OR ');
    const orUrl = `/api/freesound?query=${encodeURIComponent(orQuery)}&token=${actualToken}&durationFilter=${encodeURIComponent(durationFilter)}&pageSize=5`;
    const orResponse = await fetch(orUrl);
    if (orResponse.ok) {
      const orData = await orResponse.json();
      results = orData?.results || [];
    }
  }

  return results
    .map((item: any) => ({
      id: String(item.id),
      name: item.name,
      duration: item.duration,
      previewUrl: item.previews?.['preview-hq-mp3'] || item.previews?.['preview-lq-mp3'] || '',
      tags: item.tags || []
    }))
    .filter((item: any) => !!item.previewUrl); // Ensure preview mp3 exists
}
