/**
 * Unified Groq chat client for the AI Copilot.
 *
 * Key order:
 *   1. Vercel / Vite env  (VITE_GROQ_API_KEY → GROQ_API_KEY → sessionStorage)
 *   2. Settings fallback   (only on 401/403/429, timeout, or network error)
 *
 * Every request waits on the global 28 RPM limiter so we stay under Groq's
 * free-tier 30 requests/minute.
 */

import { getEnvGroqKey, getLocalGroqKey, hydrateKeysFromServer } from '../apiKeyManager';
import { globalRateLimiter } from './RateLimiter';
import {
  getCatalogOrFallback,
  resolveGroqCatalog,
  type GroqModelCatalog,
} from './groqModelCatalog';

export type GroqKeySource = 'env' | 'settings' | 'none';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<Record<string, unknown>>;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface GroqToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface GroqChatOptions {
  messages: GroqChatMessage[];
  tools?: GroqToolDef[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  model?: string;
  purpose?: 'reasoning' | 'vision' | 'fast';
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GroqChatResult {
  content: string;
  toolCalls: GroqToolCall[];
  model: string;
  keySource: GroqKeySource;
  finishReason?: string;
  raw: any;
}

export class GroqRequestError extends Error {
  status?: number;
  keySource: GroqKeySource;
  retryable: boolean;
  constructor(message: string, opts: { status?: number; keySource: GroqKeySource; retryable?: boolean }) {
    super(message);
    this.name = 'GroqRequestError';
    this.status = opts.status;
    this.keySource = opts.keySource;
    this.retryable = opts.retryable ?? false;
  }
}

export function resolveGroqKeySources(): { env: string; settings: string } {
  return {
    env: (getEnvGroqKey() || '').trim(),
    settings: (getLocalGroqKey() || '').trim(),
  };
}

export function getPreferredGroqKey(): { key: string; source: GroqKeySource } {
  const { env, settings } = resolveGroqKeySources();
  if (env) return { key: env, source: 'env' };
  if (settings) return { key: settings, source: 'settings' };
  return { key: '', source: 'none' };
}

export function hasAnyGroqKey(): boolean {
  return getPreferredGroqKey().source !== 'none';
}

export async function ensureGroqReady(): Promise<GroqModelCatalog> {
  await hydrateKeysFromServer().catch(() => undefined);
  const { key } = getPreferredGroqKey();
  return resolveGroqCatalog(key || undefined);
}

function pickModel(purpose: GroqChatOptions['purpose'], explicit?: string): string {
  if (explicit) return explicit;
  const cat = getCatalogOrFallback();
  if (purpose === 'vision') return cat.vision;
  if (purpose === 'fast') return cat.fast;
  return cat.reasoning;
}

function shouldFailover(status?: number, err?: unknown): boolean {
  if (status === 401 || status === 403 || status === 429 || status === 408 || status === 503) {
    return true;
  }
  if (err && typeof err === 'object') {
    const name = (err as { name?: string }).name;
    if (name === 'AbortError' || name === 'TimeoutError') return true;
  }
  return false;
}

async function rawChat(
  apiKey: string,
  keySource: GroqKeySource,
  opts: GroqChatOptions,
  model: string
): Promise<GroqChatResult> {
  await globalRateLimiter.waitForSlot();
  if (globalRateLimiter.isInCooldown()) {
    await globalRateLimiter.waitForSlot();
  }
  globalRateLimiter.recordCall();

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 35000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onOuterAbort, { once: true });
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2500,
    stream: false,
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? 'auto';
  }
  if (opts.json) {
    body.response_format = { type: 'json_object' };
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 429) {
      globalRateLimiter.startCooldown('groq_429');
      throw new GroqRequestError(`Rate limit hit (429) on ${keySource} key`, {
        status: 429,
        keySource,
        retryable: true,
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GroqRequestError(`Groq API ${res.status}: ${text.slice(0, 240)}`, {
        status: res.status,
        keySource,
        retryable: shouldFailover(res.status),
      });
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message ?? {};
    const toolCalls: GroqToolCall[] = Array.isArray(message.tool_calls)
      ? message.tool_calls
      : [];

    return {
      content: typeof message.content === 'string' ? message.content : '',
      toolCalls,
      model,
      keySource,
      finishReason: data?.choices?.[0]?.finish_reason,
      raw: data,
    };
  } catch (err: any) {
    if (err instanceof GroqRequestError) throw err;
    const isAbort = err?.name === 'AbortError';
    throw new GroqRequestError(
      isAbort ? 'Groq request timed out' : (err?.message || 'Groq network error'),
      { keySource, retryable: true, status: isAbort ? 408 : undefined }
    );
  } finally {
    clearTimeout(timeoutId);
    if (opts.signal) opts.signal.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Chat completion with env-first key, settings fallback, and live model IDs.
 */
export async function groqChat(opts: GroqChatOptions): Promise<GroqChatResult> {
  await hydrateKeysFromServer().catch(() => undefined);
  const { env, settings } = resolveGroqKeySources();
  if (!env && !settings) {
    throw new GroqRequestError(
      'No Groq API key configured. Set VITE_GROQ_API_KEY on Vercel or add a key in Settings.',
      { keySource: 'none', retryable: false }
    );
  }

  // Discover / refresh catalog using the preferred key (doesn't count as a
  // chat completion against the same budget if cached).
  await resolveGroqCatalog(env || settings).catch(() => undefined);
  const model = pickModel(opts.purpose ?? 'reasoning', opts.model);

  const attempts: Array<{ key: string; source: GroqKeySource }> = [];
  if (env) attempts.push({ key: env, source: 'env' });
  if (settings && settings !== env) attempts.push({ key: settings, source: 'settings' });

  let lastError: GroqRequestError | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      return await rawChat(attempt.key, attempt.source, opts, model);
    } catch (err: any) {
      lastError = err instanceof GroqRequestError
        ? err
        : new GroqRequestError(err?.message || 'Unknown Groq error', {
            keySource: attempt.source,
            retryable: true,
          });
      // Never fail over to the settings key on a 429: the rate limit is
      // per-key and the second key fires after a 60s cooldown anyway, so the
      // fallback only doubles the damage. Auth errors (401/403) still fail
      // over via lastError.retryable from shouldFailover().
      const canTryNext =
        i < attempts.length - 1 && lastError.retryable && lastError.status !== 429;
      if (!canTryNext) throw lastError;
      console.warn(
        `[groqChat] ${attempt.source} key failed (${lastError.status ?? 'net'}). Falling back to settings key.`
      );
    }
  }

  throw lastError ?? new GroqRequestError('Groq request failed', { keySource: 'none' });
}

export async function groqTranscribe(audioBlob: Blob): Promise<string> {
  await hydrateKeysFromServer().catch(() => undefined);
  const { env, settings } = resolveGroqKeySources();
  const keys: Array<{ key: string; source: GroqKeySource }> = [];
  if (env) keys.push({ key: env, source: 'env' });
  if (settings && settings !== env) keys.push({ key: settings, source: 'settings' });
  if (keys.length === 0) {
    throw new GroqRequestError('No Groq API key for transcription', { keySource: 'none' });
  }

  const catalog = await resolveGroqCatalog(keys[0].key).catch(() => getCatalogOrFallback());
  const model = catalog.whisper || 'whisper-large-v3-turbo';

  let lastError: Error | null = null;
  for (const attempt of keys) {
    await globalRateLimiter.waitForSlot();
    globalRateLimiter.recordCall();
    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    form.append('model', model);
    form.append('response_format', 'json');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${attempt.key}` },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.status === 429) {
        globalRateLimiter.startCooldown('groq_429_whisper');
        lastError = new GroqRequestError('Whisper rate limited', {
          status: 429,
          keySource: attempt.source,
          retryable: true,
        });
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        lastError = new GroqRequestError(`Whisper ${res.status}: ${text.slice(0, 160)}`, {
          status: res.status,
          keySource: attempt.source,
          retryable: shouldFailover(res.status),
        });
        continue;
      }
      const data = await res.json();
      return (data?.text || '').trim();
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Transcription failed');
}

export function toOpenAiTools(
  registry: Array<{ name: string; description: string; parameters: Record<string, any> }>
): GroqToolDef[] {
  return registry.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? { type: 'object', properties: {} },
    },
  }));
}
