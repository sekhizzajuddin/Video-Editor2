export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(200).json({
    geminiApiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    groqApiKey: process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || '',
    huggingFaceApiKey: process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY || '',
    elevenLabsApiKey: process.env.VITE_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '',
  });
}
