export default async function handler(req, res) {
  const { query, durationFilter, pageSize, token } = req.query;

  // Prioritize environment variable over client-provided token if available
  const envToken = process.env.VITE_FREESOUND_API_KEY || process.env.FREESOUND_API_KEY;
  const actualToken = envToken || token;

  if (!actualToken) {
    return res.status(401).json({ error: 'No Freesound token provided.' });
  }

  const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&token=${actualToken}&fields=id,name,previews,duration,tags&filter=${encodeURIComponent(durationFilter)}&page_size=${pageSize}`;

  try {
    const freesoundRes = await fetch(url);
    if (!freesoundRes.ok) {
      const errorText = await freesoundRes.text();
      return res.status(freesoundRes.status).json({ error: `Freesound API error: ${freesoundRes.status} - ${errorText}` });
    }
    const data = await freesoundRes.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Freesound proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch from Freesound API' });
  }
}
