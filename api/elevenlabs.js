export const config = {
  runtime: 'edge', // Using Edge Runtime to bypass standard Node.js timeout limits
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { text, duration_seconds, prompt_influence, token } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text prompt is required' }), { status: 400 });
    }

    // Prioritize environment variable over client-provided token
    const envToken = process.env.VITE_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
    const actualToken = envToken || token;

    if (!actualToken) {
      return new Response(JSON.stringify({ error: 'No ElevenLabs API token provided' }), { status: 401 });
    }

    console.log(`[ElevenLabs Edge] Generating SFX. Text: "${text.substring(0, 50)}...", Duration: ${duration_seconds}`);

    const elevenLabsRes = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': actualToken,
      },
      body: JSON.stringify({
        text,
        duration_seconds: duration_seconds || undefined, // Allow ElevenLabs to decide if not provided
        prompt_influence: prompt_influence ?? 0.3, // Default is 0.3
      }),
    });

    if (!elevenLabsRes.ok) {
      let errorText = '';
      try {
        const errorJson = await elevenLabsRes.json();
        errorText = JSON.stringify(errorJson);
      } catch (e) {
        errorText = await elevenLabsRes.text();
      }
      
      console.error(`[ElevenLabs Edge] API Error (${elevenLabsRes.status}):`, errorText);
      return new Response(JSON.stringify({ 
        error: `ElevenLabs API error (${elevenLabsRes.status})`,
        details: errorText
      }), { status: elevenLabsRes.status });
    }

    // Return the raw audio stream directly back to the client
    return new Response(elevenLabsRes.body, {
      status: 200,
      headers: {
        'Content-Type': elevenLabsRes.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      }
    });

  } catch (error) {
    console.error('[ElevenLabs Edge] Server Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500 });
  }
}
