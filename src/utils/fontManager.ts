export interface CustomFont {
  family: string;
  fileName: string;
  loadedAt: number;
}

const CUSTOM_FONTS_KEY = 'procut_custom_fonts';
const FONT_BLOB_KEY = 'procut_font_blob_';

export async function addCustomFont(file: File): Promise<CustomFont> {
  const family = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
  const arrayBuffer = await file.arrayBuffer();
  const fontFace = new FontFace(family, arrayBuffer);
  await fontFace.load();
  document.fonts.add(fontFace);

  const fontInfo: CustomFont = {
    family,
    fileName: file.name,
    loadedAt: Date.now(),
  };

  const existing = getCustomFonts();
  if (!existing.find((f) => f.family === family)) {
    existing.push(fontInfo);
    localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(existing));
  }

  try {
    localStorage.setItem(FONT_BLOB_KEY + family, arrayBufferToBase64(arrayBuffer));
  } catch {
    // Storage quota exceeded - font will work this session but not persist
  }

  return fontInfo;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function getCustomFonts(): CustomFont[] {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return [];
    const raw = localStorage.getItem(CUSTOM_FONTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function restoreCustomFonts(): Promise<void> {
  const fonts = getCustomFonts();
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return;
  for (const font of fonts) {
    try {
      const base64 = localStorage.getItem(FONT_BLOB_KEY + font.family);
      if (!base64) continue;
      const arrayBuffer = base64ToArrayBuffer(base64);
      const fontFace = new FontFace(font.family, arrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
    } catch (err) {
      console.warn('Failed to restore font', font.family, err);
    }
  }
}

export function removeCustomFont(family: string): void {
  const existing = getCustomFonts().filter((f) => f.family !== family);
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(existing));
    localStorage.removeItem(FONT_BLOB_KEY + family);
  }

  for (const fontFace of Array.from(document.fonts)) {
    if (fontFace.family === family) {
      document.fonts.delete(fontFace);
    }
  }
}

export const SYSTEM_FONTS = [
  'Inter',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Roboto',
  'Open Sans',
  'Lato',
  'Courier New',
  'Bebas Neue',
  'Anton',
  'Oswald',
  'Outfit',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Trebuchet MS',
];

export function getAllAvailableFonts(): string[] {
  const customs = getCustomFonts().map((f) => f.family);
  return [...SYSTEM_FONTS, ...customs];
}

// ─────────────────────────────────────────────────────────────────────────────
// Font Caching & Export Synchronization (IndexedDB & Web Worker Transfer)
// ─────────────────────────────────────────────────────────────────────────────

const FONT_DB_NAME = 'procut_fonts_db';
const FONT_STORE_NAME = 'fonts';

function openFontDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(FONT_DB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(FONT_STORE_NAME)) {
          db.createObjectStore(FONT_STORE_NAME, { keyPath: 'family' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedFont(family: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openFontDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(FONT_STORE_NAME, 'readonly');
      const store = tx.objectStore(FONT_STORE_NAME);
      const req = store.get(family.toLowerCase());
      req.onsuccess = () => {
        if (req.result && req.result.buffer instanceof ArrayBuffer) {
          resolve(req.result.buffer);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveCachedFont(family: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openFontDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(FONT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(FONT_STORE_NAME);
      store.put({ family: family.toLowerCase(), buffer, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-fatal
  }
}

export const DIRECT_FONT_URLS: Record<string, string> = {
  'bebas neue': 'https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf',
  'inter': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
  'oswald': 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvgUE.ttf',
  'montserrat': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf',
  'poppins': 'https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJA.ttf',
  'roboto': 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
  'lato': 'https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXiWtFCc.ttf',
  'open sans': 'https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVQUwaEQbjA.ttf',
  'playfair display': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.ttf',
  'anton': 'https://fonts.gstatic.com/s/anton/v25/1Ptgg87LROUu34Rq9VozCA.ttf',
  'outfit': 'https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NJtEtq.ttf',
};

export interface ExportFontPayload {
  family: string;
  buffer: ArrayBuffer;
}

const OS_SYSTEM_FONTS = new Set([
  'arial', 'helvetica', 'times new roman', 'georgia', 'verdana',
  'impact', 'comic sans ms', 'courier new', 'trebuchet ms', 'sans-serif', 'serif', 'monospace'
]);

/**
 * Prepares and collects binary ArrayBuffers for all fonts used in the timeline
 * so they can be transferred to export.worker.ts and registered in WorkerGlobalScope.
 */
export async function prepareFontsForExport(timeline: any): Promise<ExportFontPayload[]> {
  if (!timeline) return [];
  const families = new Set<string>();

  for (const track of (timeline.tracks || [])) {
    for (const clip of (track.clips || [])) {
      const fam = clip.textSettings?.fontFamily || clip.fontFamily;
      if (fam && typeof fam === 'string') {
        const clean = fam.replace(/['"]/g, '').split(',')[0].trim();
        if (clean) families.add(clean);
      }
    }
  }

  const results: ExportFontPayload[] = [];

  for (const family of families) {
    const lower = family.toLowerCase();
    if (OS_SYSTEM_FONTS.has(lower)) continue;

    try {
      // 1. Check custom fonts in localStorage
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const base64 = localStorage.getItem(FONT_BLOB_KEY + family);
        if (base64) {
          results.push({ family, buffer: base64ToArrayBuffer(base64) });
          continue;
        }
      }

      // 2. Check IndexedDB font cache
      const cached = await getCachedFont(family);
      if (cached) {
        // Clone slice to allow transferable postMessage without detaching cached buffer
        results.push({ family, buffer: cached.slice(0) });
        continue;
      }

      // 3. Fetch from direct URL map or Google Fonts
      let fontBuffer: ArrayBuffer | null = null;
      const directUrl = DIRECT_FONT_URLS[lower];
      if (directUrl && typeof fetch !== 'undefined') {
        try {
          const resp = await fetch(directUrl);
          if (resp.ok) {
            fontBuffer = await resp.arrayBuffer();
          }
        } catch {
          // network error or offline
        }
      }

      if (!fontBuffer && typeof fetch !== 'undefined') {
        try {
          const formattedFamily = family.replace(/\s+/g, '+');
          const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(formattedFamily)}&display=swap`;
          const cssResp = await fetch(cssUrl);
          if (cssResp.ok) {
            const cssText = await cssResp.text();
            const match = cssText.match(/src:\s*url\((https:\/\/[^)]+)\)/);
            if (match && match[1]) {
              const fUrl = match[1].replace(/['"]/g, '');
              const fResp = await fetch(fUrl);
              if (fResp.ok) {
                fontBuffer = await fResp.arrayBuffer();
              }
            }
          }
        } catch {
          // non-fatal
        }
      }

      if (fontBuffer) {
        await saveCachedFont(family, fontBuffer.slice(0));
        results.push({ family, buffer: fontBuffer });
      }
    } catch (err) {
      console.warn(`[fontManager] Could not prepare font "${family}" for export:`, err);
    }
  }

  return results;
}

/**
 * Pre-cache popular fonts in the background so export works offline and without delay.
 */
export async function preloadStandardFonts(): Promise<void> {
  if (typeof fetch === 'undefined') return;
  const keys = ['inter', 'bebas neue', 'montserrat', 'roboto', 'oswald', 'poppins'];
  for (const key of keys) {
    try {
      const cached = await getCachedFont(key);
      if (!cached && DIRECT_FONT_URLS[key]) {
        const resp = await fetch(DIRECT_FONT_URLS[key]);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          await saveCachedFont(key, buf);
        }
      }
    } catch {
      // Background preload error is harmless
    }
  }
}
