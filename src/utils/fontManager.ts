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
    const raw = localStorage.getItem(CUSTOM_FONTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function restoreCustomFonts(): Promise<void> {
  const fonts = getCustomFonts();
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
  localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(existing));
  localStorage.removeItem(FONT_BLOB_KEY + family);

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
  'Trebuchet MS',
];

export function getAllAvailableFonts(): string[] {
  const customs = getCustomFonts().map((f) => f.family);
  return [...SYSTEM_FONTS, ...customs];
}
