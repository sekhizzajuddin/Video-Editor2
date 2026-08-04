export async function generateImageFromCloudflare(
  prompt: string,
  accountId: string,
  apiToken: string
): Promise<string> {
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare API credentials are not set in settings.');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;

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

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('Cloudflare AI API returned an empty image');
  }
  return URL.createObjectURL(blob);
}
