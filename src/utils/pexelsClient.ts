/**
 * pexelsClient.ts
 * Utility to fetch free stock videos from Pexels, and fallback to Pollinations.AI
 * for free image generation if no video is found.
 */

export interface StockVisualResult {
  type: 'video' | 'image';
  url: string;
  source: 'pexels' | 'pollinations';
  duration?: number; // In seconds
}

/**
 * Search for stock videos on Pexels.
 * Requires VITE_PEXELS_API_KEY in .env.
 */
export async function searchPexelsVideos(
  query: string,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
  apiKey?: string,
  count: number = 5,
  style: string = 'realistic'
): Promise<StockVisualResult[]> {
  const key = apiKey || import.meta.env.VITE_PEXELS_API_KEY;
  if (!key) {
    console.warn('No Pexels API Key configured.');
    return [];
  }

  try {
    let finalQuery = query;
    if (style === 'anime') finalQuery += ' anime style animated';
    else if (style === 'watercolor') finalQuery += ' watercolor painted painting';
    else if (style === 'papercut') finalQuery += ' papercut craft stop motion';

    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.append('query', finalQuery);
    url.searchParams.append('per_page', '15');
    url.searchParams.append('orientation', orientation);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: key,
      },
    });

    if (!res.ok) {
      console.warn('Pexels API returned status:', res.status);
      return [];
    }

    const data = await res.json();
    if (!data.videos || data.videos.length === 0) {
      return [];
    }

    const results: StockVisualResult[] = [];
    const maxIndex = Math.min(15, data.videos.length);
    
    for (let i = 0; i < maxIndex; i++) {
      const video = data.videos[i];
      if (!video.video_files || video.video_files.length === 0) continue;

      const sortedFiles = [...video.video_files].sort((a, b) => {
        const resA = a.width * a.height;
        const resB = b.width * b.height;
        return resB - resA;
      });

      const bestFile = sortedFiles.find(f => f.width === 1920 || f.width === 1080) || sortedFiles[0];
      if (bestFile) {
        results.push({
          type: 'video',
          url: bestFile.link,
          source: 'pexels',
          duration: video.duration,
        });
      }
      
      if (results.length >= count) break;
    }

    return results;
  } catch (err) {
    console.error('Error fetching Pexels videos:', err);
    return [];
  }
}

/**
 * Generate a free image using Pollinations.AI (No API Key required)
 * Optionally uses image-to-image character reference.
 */
export function generatePollinationsImageWithReference(
  prompt: string,
  referenceImageUrl?: string | null,
  seed?: number,
  width: number = 1920,
  height: number = 1080
): StockVisualResult {
  const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
  const cleanPrompt = encodeURIComponent(prompt.substring(0, 1000));
  
  let url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true&seed=${actualSeed}`;
  if (referenceImageUrl) {
    url += `&image=${encodeURIComponent(referenceImageUrl)}`;
  }

  return {
    type: 'image',
    url,
    source: 'pollinations',
    duration: 5, // Default 5 seconds
  };
}

/**
 * Orchestrator: Try to get a Pexels video, if it fails, generate a Pollinations image.
 */
export async function fetchStockVisualForScene(
  query: string,
  orientation: 'landscape' | 'portrait' = 'landscape',
  apiKey?: string
): Promise<StockVisualResult> {
  // 1. Try Pexels Video
  const pexelsResults = await searchPexelsVideos(query, orientation, apiKey, 1);
  if (pexelsResults.length > 0) {
    return pexelsResults[0];
  }

  // 2. Fallback to Pollinations AI Image
  console.log(`No video found for "${query}", falling back to Pollinations.AI image.`);
  
  // Format the prompt a bit better for image generation
  const enhancedPrompt = `High quality cinematic photo of ${query}, highly detailed, 8k resolution, photorealistic`;
  const width = orientation === 'landscape' ? 1920 : 1080;
  const height = orientation === 'landscape' ? 1080 : 1920;
  
  return generatePollinationsImageWithReference(enhancedPrompt, null, undefined, width, height);
}

