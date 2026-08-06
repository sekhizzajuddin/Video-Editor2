import { useEditorStore } from '@/store/editorStore';

// ─── Server-key Hydration ─────────────────────────────────────────────────────
// Eagerly fetch API keys from /api/keys (Vercel serverless) at module load time.
// This fires BEFORE any React useEffect, so keys are available in sessionStorage
// the instant the first AI call is made — even if the user opens the chatbot
// immediately on page load.
//
// Why not rely on VITE_GROQ_API_KEY?
// Vite only bakes VITE_-prefixed vars at build time. Vercel env vars are named
// GROQ_API_KEY (no prefix) and are only accessible server-side. The /api/keys
// endpoint is the correct bridge. Previously the fetch only ran in a React
// useEffect, creating a race window of ~200–500ms that caused 401 errors.

let _hydrationDone = false;
let _hydrationPromise: Promise<void> | null = null;

export function hydrateKeysFromServer(): Promise<void> {
  if (_hydrationDone) return Promise.resolve();
  if (_hydrationPromise) return _hydrationPromise;

  _hydrationPromise = fetch('/api/keys')
    .then((res) => {
      if (!res.ok) throw new Error(`/api/keys returned ${res.status}`);
      return res.json();
    })
    .then((data: Record<string, string>) => {
      if (data.geminiApiKey)     sessionStorage.setItem('procut_gemini_key',     data.geminiApiKey);
      if (data.groqApiKey)       sessionStorage.setItem('procut_groq_key',       data.groqApiKey);
      if (data.huggingFaceApiKey) sessionStorage.setItem('procut_huggingface_key', data.huggingFaceApiKey);
      if (data.elevenLabsApiKey)  sessionStorage.setItem('procut_elevenlabs_key', data.elevenLabsApiKey);
      _hydrationDone = true;
      console.info('[apiKeyManager] Keys hydrated from /api/keys');
    })
    .catch((err) => {
      // /api/keys only exists on Vercel. In local dev this 404s — that's fine.
      // Local dev uses VITE_-prefixed env vars baked into the bundle by Vite.
      console.warn('[apiKeyManager] /api/keys not available (local dev or error):', err?.message ?? err);
      _hydrationDone = true; // Don't retry on failure
    });

  return _hydrationPromise;
}

// Fire immediately at module load so keys are ready before any component mounts.
hydrateKeysFromServer();

// ─── Key Getters ──────────────────────────────────────────────────────────────

/**
 * Gets the primary Gemini key from the environment variables.
 */
export function getEnvGeminiKey(): string {
  // @ts-ignore
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || sessionStorage.getItem('procut_gemini_key') || '';
}

/**
 * Gets the primary Groq key from the environment variables.
 */
export function getEnvGroqKey(): string {
  // @ts-ignore
  return import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY || sessionStorage.getItem('procut_groq_key') || '';
}

/**
 * Gets the primary HuggingFace key from the environment variables.
 */
export function getEnvHuggingFaceKey(): string {
  // @ts-ignore
  return import.meta.env.VITE_HUGGINGFACE_API_KEY || import.meta.env.HUGGINGFACE_API_KEY || sessionStorage.getItem('procut_huggingface_key') || '';
}

/**
 * Gets the primary ElevenLabs key from the environment variables.
 */
export function getEnvElevenLabsKey(): string {
  // @ts-ignore
  return import.meta.env.VITE_ELEVENLABS_API_KEY || import.meta.env.ELEVENLABS_API_KEY || sessionStorage.getItem('procut_elevenlabs_key') || '';
}


/**
 * Gets the local fallback Gemini key provided by the user in settings.
 */
export function getLocalGeminiKey(): string {
  return useEditorStore.getState().settings.geminiApiKey || '';
}

/**
 * Gets the local fallback Groq key provided by the user in settings.
 */
export function getLocalGroqKey(): string {
  return useEditorStore.getState().settings.groqApiKey || '';
}

/**
 * Gets the local fallback HuggingFace key provided by the user in settings.
 */
export function getLocalHuggingFaceKey(): string {
  return useEditorStore.getState().settings.huggingFaceApiKey || '';
}

/**
 * Gets the local fallback ElevenLabs key provided by the user in settings.
 */
export function getLocalElevenLabsKey(): string {
  return useEditorStore.getState().settings.elevenLabsApiKey || '';
}

/**
 * A robust fetch wrapper that automatically fails over to the local API key
 * if the environment API key returns a 429 Rate Limit or network error.
 */
export async function fetchWithKeyFailover(
  urlBuilder: (key: string) => string,
  options: RequestInit,
  provider: 'gemini' | 'groq'
): Promise<Response> {
  const envKey = provider === 'gemini' ? getEnvGeminiKey() : getEnvGroqKey();
  const localKey = provider === 'gemini' ? getLocalGeminiKey() : getLocalGroqKey();

  let firstError: any = null;

  const executeFetch = async (keyToUse: string) => {
    const url = urlBuilder(keyToUse);
    const fetchOptions = { ...options };
    
    if (provider === 'groq') {
      const existingHeaders = (fetchOptions.headers as Record<string, string>) || {};
      fetchOptions.headers = {
        ...existingHeaders,
        'Authorization': `Bearer ${keyToUse}`
      };
    }
    
    return await fetch(url, fetchOptions);
  };

  // Try Env Key first
  if (envKey) {
    try {
      const res = await executeFetch(envKey);
      
      // If success or a non-rate-limit error (like 400 Bad Request), return it immediately
      if (res.ok || (res.status !== 429 && res.status !== 401 && res.status !== 403)) {
        return res;
      }
      
      console.warn(`[${provider.toUpperCase()}] Env key returned status ${res.status}. Attempting fallback...`);
      firstError = res; // Save the response so we can return it if fallback also fails
    } catch (err) {
      console.warn(`[${provider.toUpperCase()}] Env key encountered network error. Attempting fallback...`);
      firstError = err;
    }
  }

  // Fallback to Local Key
  if (localKey && localKey !== envKey) {
    console.info(`[${provider.toUpperCase()}] Using local user-provided API key as fallback.`);
    try {
      const fallbackRes = await executeFetch(localKey);
      return fallbackRes; // Return the fallback response regardless of its status
    } catch (fallbackErr) {
      console.error(`[${provider.toUpperCase()}] Local fallback key also encountered network error.`);
      throw fallbackErr;
    }
  }

  // If we reach here, we had no local key to fall back on, so throw/return the original error
  if (firstError instanceof Response || (firstError && typeof firstError.status === 'number' && typeof firstError.ok === 'boolean')) {
    return firstError as Response;
  } else if (firstError instanceof Error) {
    throw firstError;
  } else if (firstError) {
    throw new Error(typeof firstError === 'string' ? firstError : JSON.stringify(firstError));
  }

  throw new Error(`[${provider.toUpperCase()}] No API key configured. Please set one in the environment or Settings Modal.`);
}
