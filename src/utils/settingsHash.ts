/**
 * settingsHash.ts
 * 
 * Deterministic hash generation for AI effect settings.
 * Used to invalidate cached masks when mask-affecting settings change.
 */

/**
 * Generate a stable hash string for background removal settings.
 * Only includes settings that affect the mask output.
 */
export function getAiBackgroundSettingsHash(settings: any): string {
  if (!settings) return 'none';
  
  const parts = [
    settings.modelSelection ?? 'default',
    `edgeBlur:${settings.edgeBlur ?? 0}`,
    `choke:${settings.choke ?? 0}`,
    `feather:${settings.feather ?? 0}`,
    `spillSuppression:${settings.spillSuppression ? '1' : '0'}`,
    `spillColor:${settings.spillColor ?? '#00ff00'}`,
  ];
  
  return parts.join('|');
}

/**
 * Generate a stable hash string for object removal settings.
 * Only includes settings that affect the inpaint result.
 */
export function getObjectRemovalSettingsHash(settings: any): string {
  if (!settings) return 'none';
  
  const parts = [
    settings.mode ?? 'content_aware',
    `x:${(settings.x ?? 50).toFixed(1)}`,
    `y:${(settings.y ?? 50).toFixed(1)}`,
    `w:${(settings.width ?? 20).toFixed(1)}`,
    `h:${(settings.height ?? 20).toFixed(1)}`,
    `rot:${(settings.rotation ?? 0).toFixed(1)}`,
    `feather:${(settings.feather ?? 10).toFixed(1)}`,
    `opacity:${(settings.opacity ?? 100).toFixed(1)}`,
    `stretch:${(settings.stretchStrength ?? 80).toFixed(1)}`,
    `srcX:${(settings.patchSourceX ?? 30).toFixed(1)}`,
    `srcY:${(settings.patchSourceY ?? 30).toFixed(1)}`,
    `shape:${settings.shape ?? 'rect'}`,
    settings.regions && settings.regions.length > 0 
      ? `regions:${settings.regions.map((r: any) => `${r.id}:${r.enabled ? '1' : '0'}:${r.x?.toFixed(1)}:${r.y?.toFixed(1)}:${r.width?.toFixed(1)}:${r.height?.toFixed(1)}:${r.mode}`).join(';')}`
      : 'no_regions',
  ];
  
  return parts.join('|');
}

/**
 * Simple string hash for use as cache key suffix.
 * Not cryptographically secure, but sufficient for cache invalidation.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
