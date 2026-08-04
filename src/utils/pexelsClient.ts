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
  thumbnail?: string;
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
          thumbnail: video.image,
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
 * Uses ContentGenerator architecture: cleans special characters, adds &model=flux,
 * and caps prompt length to prevent Pollinations 500 errors.
 */
export function generatePollinationsImageWithReference(
  prompt: string,
  referenceImageUrl?: string | null,
  seed?: number,
  width: number = 1024,
  height: number = 576,
  model: string = 'flux'
): StockVisualResult {
  const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
  const rawPrompt = typeof prompt === 'string' && prompt.trim() ? prompt : 'vintage documentary background';
  
  // Cap max dimensions to 1024x576 to prevent GPU OOM 500 errors on Pollinations
  const safeWidth = Math.min(width || 1024, 1024);
  const safeHeight = Math.min(height || 576, 1024);

  // Clean prompt for Pollinations (matching ContentGenerator architecture):
  // 1. Replace #00FF00 hex specs with clean text "solid green background"
  // 2. Strip special characters [^a-zA-Z0-9\s] to prevent URL path encoding 500 errors on Pollinations server
  // 3. Cap at 150 characters max
  const cleanKeywordPrompt = rawPrompt
    .replace(/solid\s*#?[0-9a-fA-F]{6}\s*green\s*screen/gi, 'solid green background')
    .replace(/#00FF00/gi, 'green')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  const cleanPrompt = encodeURIComponent(cleanKeywordPrompt || 'vintage documentary background');
  
  let url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${safeWidth}&height=${safeHeight}&nologo=true&seed=${actualSeed}&model=${model}`;
  if (referenceImageUrl) {
    url += `&image=${encodeURIComponent(referenceImageUrl)}`;
  }

  return {
    type: 'image',
    url,
    source: 'pollinations',
    duration: 5,
    thumbnail: url,
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
  const options = await fetchStockVisualOptionsForScene(query, orientation, apiKey, 1);
  return options[0];
}

export async function fetchStockVisualOptionsForScene(
  query: string,
  orientation: 'landscape' | 'portrait' = 'landscape',
  apiKey?: string,
  count: number = 3
): Promise<StockVisualResult[]> {
  const pexelsResults = await searchPexelsVideos(query, orientation, apiKey, count);
  if (pexelsResults.length > 0) {
    return pexelsResults;
  }

  console.log(`No video found for "${query}", falling back to Pollinations.AI images.`);
  const enhancedPrompt = `High quality cinematic photo of ${query}, highly detailed, 8k resolution, photorealistic`;
  const width = orientation === 'landscape' ? 1024 : 576;
  const height = orientation === 'landscape' ? 576 : 1024;
  
  const options: StockVisualResult[] = [];
  for (let i = 0; i < count; i++) {
    // vary the seed to get different images
    options.push(generatePollinationsImageWithReference(enhancedPrompt, null, undefined, width, height));
  }
  return options;
}

