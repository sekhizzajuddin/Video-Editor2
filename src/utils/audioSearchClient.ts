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
  token: string = DEFAULT_FREESOUND_TOKEN
): Promise<AudioOption[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Filter out tracks that are too long (>15s) for standard SFX, unless query suggests background music (BGM)
  const isBgm = query.toLowerCase().includes('music') || query.toLowerCase().includes('bgm') || query.toLowerCase().includes('ambient');
  const durationFilter = isBgm ? 'duration:[10.0 TO 300.0]' : 'duration:[0.5 TO 15.0]';

  const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(cleanQuery)}&token=${token}&fields=id,name,previews,duration,tags&filter=${durationFilter}&page_size=5`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Freesound API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const results = data?.results || [];

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
