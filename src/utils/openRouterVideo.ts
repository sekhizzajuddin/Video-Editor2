import { OpenRouterModel } from '../types';

const BASE_URL = 'https://openrouter.ai/api/v1';

export const fetchAIModels = async (apiKey: string): Promise<OpenRouterModel[]> => {
  try {
    const response = await fetch(`${BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from OpenRouter');
    }

    const data = await response.json();
    // Filter models that are typically video or image-to-video
    const videoKeywords = ['kling', 'veo', 'seedance', 'wan', 'sora', 'minimax', 'hailuo', 'runway', 'luma', 'flux', 'stable-diffusion', 'dall-e', 'ideogram', 'midjourney', 'nvidia'];
    
    const videoModels = data.data.filter((model: any) => {
      const isVideoOrImage = videoKeywords.some(kw => model.id.toLowerCase().includes(kw));
      // Specifically filter out known pure coding/text models if they accidentally matched
      const isCoding = model.id.toLowerCase().includes('coder') || model.id.toLowerCase().includes('code:');
      return isVideoOrImage && !isCoding;
    });

    return videoModels;
  } catch (error) {
    console.error('Error fetching video models:', error);
    return [];
  }
};

export const generateAIVideo = async (prompt: string, modelId: string, apiKey: string, imageUrl?: string): Promise<string> => {
  const payload: any = {
    model: modelId,
    messages: [
      {
        role: "user",
        content: []
      }
    ]
  };

  if (imageUrl) {
    payload.messages[0].content.push({
      type: "image_url",
      image_url: { url: imageUrl }
    });
  }

  payload.messages[0].content.push({
    type: "text",
    text: prompt
  });

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Sekhi Video Editor'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start video generation: ${errorText}`);
  }

  const data = await response.json();
  
  if (data.id && (!data.choices || data.choices.length === 0 || !data.choices[0].message.content)) {
     return data.id;
  }
  
  if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content; 
  }
  
  return data.id; 
};

export const checkVideoJobStatus = async (jobId: string, apiKey: string): Promise<{status: string, resultUrl?: string, error?: string}> => {
  try {
    const response = await fetch(`${BASE_URL}/generation?id=${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      return { status: 'failed', error: 'Failed to poll status' };
    }

    const data = await response.json();
    return {
      status: 'completed',
      resultUrl: data.data?.choices?.[0]?.message?.content || null
    };
  } catch (error: any) {
    return { status: 'failed', error: error.message };
  }
};
