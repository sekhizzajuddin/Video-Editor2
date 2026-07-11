export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const urlObj = new URL(req.url);
  const model = urlObj.searchParams.get('model');
  if (!model) {
    return new Response(JSON.stringify({ error: 'Missing model query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const envKey = process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  const authHeader = req.headers.get('authorization');
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (envKey) {
    headers['Authorization'] = `Bearer ${envKey}`;
  } else if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  let requestBody;
  try {
    requestBody = await req.text();
  } catch (e) {
    requestBody = '';
  }

  const targetUrl = `https://api-inference.huggingface.co/models/${model}`;

  try {
    const hfResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    const responseHeaders = new Headers();
    const contentType = hfResponse.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('content-type', contentType);
    }

    return new Response(hfResponse.body, {
      status: hfResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('HuggingFace Edge proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from HuggingFace API proxy' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
