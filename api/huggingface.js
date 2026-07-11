export const config = {
  runtime: 'edge',
  // Edge functions have 30s timeout on Hobby plan (vs 10s for Node.js)
};

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') || 'cvssp/audioldm2';

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');

    const envKey = process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY || '';
    const clientAuth = request.headers.get('authorization') || '';

    if (envKey) {
      headers.set('Authorization', 'Bearer ' + envKey);
    } else if (clientAuth) {
      headers.set('Authorization', clientAuth);
    }

    const body = await request.text();
    const targetUrl = 'https://api-inference.huggingface.co/models/' + model;

    const hfResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    const responseHeaders = new Headers();
    const ct = hfResponse.headers.get('content-type');
    if (ct) {
      responseHeaders.set('Content-Type', ct);
    }

    // Stream the HuggingFace response body directly back to the client
    return new Response(hfResponse.body, {
      status: hfResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: 'Edge proxy failed', details: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
