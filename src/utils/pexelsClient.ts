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
 * Search for a stock video on Pexels.
 * Requires VITE_PEXELS_API_KEY in .env.
 */
export async function searchPexelsVideo(
  query: string,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
  apiKey?: string
): Promise<StockVisualResult | null> {
  const key = apiKey || import.meta.env.VITE_PEXELS_API_KEY;
  if (!key) {
    console.warn('No Pexels API Key configured.');
    return null;
  }

  try {
    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.append('query', query);
    url.searchParams.append('per_page', '15');
    url.searchParams.append('orientation', orientation);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: key,
      },
    });

    if (!res.ok) {
      console.warn('Pexels API returned status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.videos || data.videos.length === 0) {
      return null;
    }

    // Pick a random video from the top 5 results for variety
    const maxIndex = Math.min(5, data.videos.length);
    const video = data.videos[Math.floor(Math.random() * maxIndex)];

    if (!video.video_files || video.video_files.length === 0) {
      return null;
    }

    // Sort video files by quality/resolution
    // For landscape, we want HD (1920x1080)
    const sortedFiles = [...video.video_files].sort((a, b) => {
      // Prefer highest resolution
      const resA = a.width * a.height;
      const resB = b.width * b.height;
      return resB - resA;
    });

    // Find a file that's HD but not massive 4K to save memory, or just take the best HD one
    let bestFile = sortedFiles.find(f => f.width === 1920 || f.width === 1080) || sortedFiles[0];

    if (!bestFile) return null;

    return {
      type: 'video',
      url: bestFile.link,
      source: 'pexels',
      duration: video.duration,
    };
  } catch (err) {
    console.error('Error fetching Pexels video:', err);
    return null;
  }
}

/**
 * Generate a free image using Pollinations.AI (No API Key required)
 */
export function generatePollinationsImage(
  prompt: string,
  width: number = 1920,
  height: number = 1080
): StockVisualResult {
  // Use a seed for consistent styles within the same prompt, or random for variety.
  // We'll add a random seed to avoid browser caching issues if we request the same prompt multiple times.
  const seed = Math.floor(Math.random() * 1000000);
  
  // Clean prompt for URL
  const cleanPrompt = encodeURIComponent(prompt.substring(0, 500)); // Cap length
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

  return {
    type: 'image',
    url,
    source: 'pollinations',
    duration: 5, // Default 5 seconds for an image
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
  const pexelsResult = await searchPexelsVideo(query, orientation, apiKey);
  if (pexelsResult) {
    return pexelsResult;
  }

  // 2. Fallback to Pollinations AI Image
  console.log(`No video found for "${query}", falling back to Pollinations.AI image.`);
  
  // Format the prompt a bit better for image generation
  const enhancedPrompt = `High quality cinematic photo of ${query}, highly detailed, 8k resolution, photorealistic`;
  const width = orientation === 'landscape' ? 1920 : 1080;
  const height = orientation === 'landscape' ? 1080 : 1920;
  
  return generatePollinationsImage(enhancedPrompt, width, height);
}
