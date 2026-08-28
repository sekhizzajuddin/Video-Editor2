export async function generateImageFromCloudflare(
  prompt: string,
  accountId: string,
  apiToken: string
): Promise<string> {
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare API credentials are not set in settings.');
  }

  const url = `/cf-api/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (e) {
      // ignore
    }
    throw new Error(`Cloudflare AI API Error: ${response.status} ${response.statusText} ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('Cloudflare AI API returned an empty image');
  }

  // Convert array buffer to base64 data URI to prevent canvas tainting in foreignObject
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/jpeg;base64,${base64}`;
}
