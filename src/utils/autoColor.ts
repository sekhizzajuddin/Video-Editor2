import { ClipColorFilters } from '@/types';

export function calculateAutoColor(
  videoElement: HTMLVideoElement | HTMLImageElement,
  currentFilters?: ClipColorFilters
): Partial<ClipColorFilters> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return {};

  const w = 128;
  const h = 72;
  canvas.width = w;
  canvas.height = h;

  try {
    ctx.drawImage(videoElement, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let sumR = 0, sumG = 0, sumB = 0;
    let minL = 255, maxL = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      sumR += r;
      sumG += g;
      sumB += b;

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance < minL) minL = luminance;
      if (luminance > maxL) maxL = luminance;
    }

    const pixelCount = w * h;
    const avgR = sumR / pixelCount;
    const avgG = sumG / pixelCount;
    const avgB = sumB / pixelCount;

    // Auto White Balance (Grey World Assumption)
    // If image is too warm (high R, low B), temperature decreases (shifts to cool/blue).
    // Our slider: -100 to 100.
    const tempShift = (avgB - avgR) * 0.5; 
    const suggestedTemp = Math.max(-100, Math.min(100, (currentFilters?.temperature || 0) + tempShift));

    // Auto Exposure / Contrast
    // Ideal minL is ~10, Ideal maxL is ~245
    // If minL is high (e.g., 50), shadows are washed out -> increase contrast, decrease exposure.
    // If maxL is low (e.g., 200), highlights are dull -> increase exposure.
    const avgL = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
    
    // Target average luminance ~128
    const exposureShift = (128 - avgL) * 0.5;
    const suggestedExposure = Math.max(-100, Math.min(100, (currentFilters?.exposure || 0) + exposureShift));

    // Contrast stretching: we want maxL - minL to be around 235
    const currentRange = maxL - minL;
    let contrastShift = 0;
    if (currentRange > 0) {
      const ratio = 235 / currentRange;
      contrastShift = (ratio - 1) * 50; 
    }
    const suggestedContrast = Math.max(0, Math.min(200, (currentFilters?.contrast || 100) + contrastShift));

    return {
      temperature: Math.round(suggestedTemp),
      exposure: Math.round(suggestedExposure),
      contrast: Math.round(suggestedContrast),
      saturation: currentFilters?.saturation || 100,
      tint: currentFilters?.tint || 0,
    };
  } catch (err) {
    console.error("Auto-Color failed:", err);
    return {};
  }
}
