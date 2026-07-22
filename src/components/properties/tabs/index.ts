/**
 * tabs/index.ts
 * 
 * Re-exports for all tab components
 * Each tab is split into feature sections
 */

export { TransformTab } from './TransformTab';
export { MaskTab } from './MaskTab';
export { ColorTab } from './ColorTab';
export { SpeedTab } from './SpeedTab';
export { AudioTab } from './AudioTab';
export { TextTab } from './TextTab';
export { EffectsTab } from './EffectsTab';
export { HistoryTab } from './HistoryTab';
export { ThumbnailTab } from './ThumbnailTab';

// Export feature sections
export * from './transform';
export * from './color';
export * from './audio';
export * from './speed';
export * from './effects';
export * from './text';
export * from './mask';