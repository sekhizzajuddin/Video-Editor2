export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const model = req.query.model;
  if (!model) {
    return res.status(400).json({ error: 'Missing model query parameter' });
  }

  const envKey = process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  const authHeader = req.headers.authorization;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (envKey) {
    headers['Authorization'] = `Bearer ${envKey}`;
  } else if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const targetUrl = `https://api-inference.huggingface.co/models/${model}`;

  try {
    // Read request body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    const hfResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body,
    });

    const contentType = hfResponse.headers.get('content-type') || 'application/json';
    const buffer = Buffer.from(await hfResponse.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.status(hfResponse.status).send(buffer);
  } catch (error) {
    console.error('HuggingFace proxy error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to fetch from HuggingFace API proxy',
      details: errMsg,
    });
  }
}
