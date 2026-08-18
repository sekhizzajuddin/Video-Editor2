/**
 * Groq model catalog — auto-discovers reasoning + vision models via the
 * official /openai/v1/models endpoint and caches the result until Groq
 * actually changes the lineup.
 *
 * Groq rotates model IDs frequently (llama-3.2-11b-vision-preview, llama-4-scout,
 * qwen3.6-27b, gpt-oss-120b, …). Hardcoding a single ID breaks the agent.
 */

export type GroqModelKind = 'reasoning' | 'vision' | 'fast' | 'whisper' | 'other';

export interface GroqModelInfo {
  id: string;
  ownedBy?: string;
  created?: number;
  kind: GroqModelKind;
}

export interface GroqModelCatalog {
  fetchedAt: number;
  fingerprint: string;
  reasoning: string;
  vision: string;
  fast: string;
  whisper: string;
  all: GroqModelInfo[];
  source: 'api' | 'fallback' | 'cache';
}

const CACHE_KEY = 'procut_groq_model_catalog_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — re-check if lineup may have changed
const MODELS_URL = 'https://api.groq.com/openai/v1/models';

/** Conservative fallbacks if /models is unreachable. Prefer currently-documented IDs. */
export const FALLBACK_CATALOG: GroqModelCatalog = {
  fetchedAt: 0,
  fingerprint: 'fallback',
  reasoning: 'openai/gpt-oss-120b',
  vision: 'meta-llama/llama-4-scout-17b-16e-instruct',
  fast: 'llama-3.1-8b-instant',
  whisper: 'whisper-large-v3-turbo',
  all: [],
  source: 'fallback',
};

const REASONING_FALLBACKS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'groq/compound',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

const VISION_FALLBACKS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3.6-27b',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
];

const FAST_FALLBACKS = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
];

const WHISPER_FALLBACKS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
];

let memoryCache: GroqModelCatalog | null = null;
let inflight: Promise<GroqModelCatalog> | null = null;

export function classifyGroqModel(id: string): GroqModelKind {
  const n = id.toLowerCase();
  if (n.includes('whisper')) return 'whisper';
  if (
    n.includes('vision') ||
    n.includes('llama-4-scout') ||
    n.includes('llama-4-maverick') ||
    n.includes('qwen3.6') ||
    n.includes('qwen/qwen3.6') ||
    n.includes('llava')
  ) {
    return 'vision';
  }
  if (
    n.includes('gpt-oss') ||
    n.includes('reasoning') ||
    n.includes('r1') ||
    n.includes('deepseek') ||
    n.includes('compound') ||
    n.includes('qwen3') ||
    n.includes('kimi') ||
    n.includes('70b') ||
    n.includes('120b')
  ) {
    return 'reasoning';
  }
  if (n.includes('instant') || n.includes('8b') || n.includes('20b')) return 'fast';
  return 'other';
}

function scoreReasoning(id: string): number {
  const n = id.toLowerCase();
  if (n.includes('gpt-oss-120b')) return 100;
  if (n.includes('compound') && !n.includes('mini')) return 92;
  if (n.includes('gpt-oss-20b')) return 88;
  if (n.includes('qwen3-32b') || n.includes('qwen3.6')) return 86;
  if (n.includes('llama-3.3-70b')) return 80;
  if (n.includes('70b')) return 70;
  if (n.includes('r1') || n.includes('reasoning')) return 75;
  if (n.includes('kimi')) return 72;
  return 10;
}

function scoreVision(id: string): number {
  const n = id.toLowerCase();
  if (n.includes('llama-4-scout')) return 100;
  if (n.includes('llama-4-maverick')) return 95;
  if (n.includes('qwen3.6')) return 90;
  if (n.includes('90b-vision')) return 70;
  if (n.includes('11b-vision')) return 60;
  if (n.includes('vision')) return 50;
  return 10;
}

function scoreFast(id: string): number {
  const n = id.toLowerCase();
  if (n.includes('llama-3.1-8b-instant')) return 100;
  if (n.includes('instant')) return 90;
  if (n.includes('gpt-oss-20b')) return 80;
  if (n.includes('8b')) return 70;
  return 10;
}

function pickBest(ids: string[], scorer: (id: string) => number, fallbacks: string[]): string {
  if (ids.length === 0) {
    return fallbacks[0];
  }
  const ranked = [...ids].sort((a, b) => scorer(b) - scorer(a));
  for (const fb of fallbacks) {
    if (ids.includes(fb)) return fb;
  }
  return ranked[0];
}

function fingerprintOf(ids: string[]): string {
  return [...ids].sort().join('|');
}

function readLocalCache(): GroqModelCatalog | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GroqModelCatalog;
    if (!parsed?.reasoning || !parsed?.vision) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(catalog: GroqModelCatalog): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
}

export function getCachedCatalog(): GroqModelCatalog | null {
  if (memoryCache) return memoryCache;
  const local = readLocalCache();
  if (local) {
    memoryCache = local;
    return local;
  }
  return null;
}

export function getCatalogOrFallback(): GroqModelCatalog {
  return getCachedCatalog() ?? FALLBACK_CATALOG;
}

function isFresh(catalog: GroqModelCatalog): boolean {
  if (!catalog.fetchedAt) return false;
  return Date.now() - catalog.fetchedAt < CACHE_TTL_MS;
}

interface GroqModelsResponse {
  data?: Array<{ id: string; owned_by?: string; created?: number }>;
}

export function buildCatalogFromIds(ids: string[], source: GroqModelCatalog['source'] = 'api'): GroqModelCatalog {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const all: GroqModelInfo[] = unique.map((id) => ({
    id,
    kind: classifyGroqModel(id),
  }));
  const reasoningIds = all.filter((m) => m.kind === 'reasoning').map((m) => m.id);
  const visionIds = all.filter((m) => m.kind === 'vision').map((m) => m.id);
  const fastIds = all.filter((m) => m.kind === 'fast' || m.kind === 'reasoning').map((m) => m.id);
  const whisperIds = all.filter((m) => m.kind === 'whisper').map((m) => m.id);

  return {
    fetchedAt: Date.now(),
    fingerprint: fingerprintOf(unique),
    reasoning: pickBest(reasoningIds.length ? reasoningIds : unique, scoreReasoning, REASONING_FALLBACKS),
    vision: pickBest(visionIds.length ? visionIds : unique, scoreVision, VISION_FALLBACKS),
    fast: pickBest(fastIds.length ? fastIds : unique, scoreFast, FAST_FALLBACKS),
    whisper: pickBest(whisperIds, () => 1, WHISPER_FALLBACKS),
    all,
    source,
  };
}

async function fetchModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(MODELS_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Groq /models ${res.status}`);
  }
  const data = (await res.json()) as GroqModelsResponse;
  return (data.data ?? []).map((m) => m.id).filter(Boolean);
}

/**
 * Resolve the live Groq catalog. Cached until TTL expires AND the fingerprint
 * of returned model IDs is unchanged. Pass a key (env first). If discovery
 * fails, returns the last good cache or hardcoded fallbacks.
 */
export async function resolveGroqCatalog(
  apiKey: string | undefined,
  opts: { force?: boolean } = {}
): Promise<GroqModelCatalog> {
  const cached = getCachedCatalog();
  if (!opts.force && cached && isFresh(cached) && cached.source === 'api') {
    return cached;
  }
  if (!apiKey) {
    return cached ?? FALLBACK_CATALOG;
  }
  if (inflight && !opts.force) return inflight;

  inflight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const ids = await fetchModels(apiKey, controller.signal);
      if (ids.length === 0) {
        return cached ?? FALLBACK_CATALOG;
      }
      const next = buildCatalogFromIds(ids, 'api');
      // If lineup is identical to a still-valid cache, keep the older fetchedAt
      // so we don't rewrite storage every call.
      if (cached && cached.fingerprint === next.fingerprint && isFresh(cached)) {
        memoryCache = cached;
        return cached;
      }
      memoryCache = next;
      writeLocalCache(next);
      return next;
    } catch (err) {
      console.warn('[groqModelCatalog] discovery failed, using cache/fallback', err);
      return cached ?? FALLBACK_CATALOG;
    } finally {
      clearTimeout(timeout);
      inflight = null;
    }
  })();

  return inflight;
}

export function invalidateGroqCatalog(): void {
  memoryCache = null;
  inflight = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}
