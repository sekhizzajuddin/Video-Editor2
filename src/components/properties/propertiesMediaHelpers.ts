import { PropertiesTab } from './propertiesTypes';
import { formatDuration } from '@/utils/mediaHelpers';

export interface ClipClassificationInput {
  rawSelectedClip: any;
  selectedTrack: any;
  selectedMediaItem: any;
  isPipClip?: boolean;
}

export interface ClipMediaTypeResult {
  isAudioClip: boolean;
  isTextClip: boolean;
  isFxClip: boolean;
  isImageClip: boolean;
  isVideoClip: boolean;
}

export function classifyClipMediaType(input: ClipClassificationInput): ClipMediaTypeResult {
  const { rawSelectedClip, selectedTrack, selectedMediaItem } = input;
  if (!rawSelectedClip) {
    return {
      isAudioClip: false,
      isTextClip: false,
      isFxClip: false,
      isImageClip: false,
      isVideoClip: false,
    };
  }

  const isAudioClip = Boolean(
    !rawSelectedClip.textSettings &&
    (
      selectedTrack?.type === 'audio' ||
      selectedMediaItem?.type === 'audio' ||
      (selectedMediaItem as any)?.mimeType?.startsWith('audio/') ||
      (selectedMediaItem?.url && /\.(mp3|wav|ogg|aac|m4a|flac|opus)(\?.*)?$/i.test(selectedMediaItem.url)) ||
      (rawSelectedClip.name && /\.(mp3|wav|ogg|aac|m4a|flac|opus)$/i.test(rawSelectedClip.name)) ||
      (typeof rawSelectedClip.mediaId === 'string' && rawSelectedClip.mediaId.includes('audio')) ||
      (typeof rawSelectedClip.id === 'string' && (rawSelectedClip.id.startsWith('clip_vocals_') || rawSelectedClip.id.startsWith('clip_inst_'))) ||
      (!selectedMediaItem?.width && !selectedMediaItem?.height && selectedMediaItem?.type !== 'video' && selectedMediaItem?.type !== 'image' && !selectedTrack?.type?.startsWith('video') && (rawSelectedClip.duration > 0 || ((selectedMediaItem?.duration ?? 0) > 0)))
    )
  );

  const isTextClip = Boolean(selectedTrack?.type === 'text' || rawSelectedClip.textSettings);

  const isFxClip = Boolean(selectedTrack?.type === 'fx' || rawSelectedClip.fxSettings || rawSelectedClip.particleSettings);

  const isImageClip = Boolean(
    !isAudioClip &&
    !isTextClip &&
    !isFxClip &&
    (
      selectedMediaItem?.type === 'image' ||
      (selectedMediaItem as any)?.mimeType?.startsWith('image/') ||
      (selectedMediaItem?.url && /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?.*)?$/i.test(selectedMediaItem.url)) ||
      (rawSelectedClip.name && /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(rawSelectedClip.name))
    )
  );

  const isVideoClip = Boolean(!isAudioClip && !isTextClip && !isFxClip && !isImageClip);

  return { isAudioClip, isTextClip, isFxClip, isImageClip, isVideoClip };
}

export function isTabSupportedForClipType(
  tab: PropertiesTab,
  mediaType: ClipMediaTypeResult,
  input: ClipClassificationInput
): boolean {
  const { rawSelectedClip, selectedTrack } = input;
  if (!rawSelectedClip || rawSelectedClip.id === '__inactive_clip__') {
    return tab === 'transform' || tab === 'mask' || tab === 'color' || tab === 'speed' || tab === 'audio' || tab === 'effects' || tab === 'thumbnail';
  }

  if (mediaType.isAudioClip) {
    return tab === 'audio' || tab === 'speed' || tab === 'effects';
  }

  if (mediaType.isTextClip || selectedTrack?.type === 'text' || rawSelectedClip.textSettings) {
    return tab === 'text' || tab === 'transform' || tab === 'color' || tab === 'effects';
  }

  if (mediaType.isFxClip || selectedTrack?.type === 'fx' || rawSelectedClip.fxSettings || rawSelectedClip.particleSettings) {
    return tab === 'effects' || tab === 'transform';
  }

  if (mediaType.isImageClip) {
    if (tab === 'pip') return !!(rawSelectedClip.pipWindowIds?.length || input.isPipClip);
    return tab === 'transform' || tab === 'mask' || tab === 'color' || tab === 'effects' || tab === 'thumbnail';
  }

  if (tab === 'thumbnail') return true;
  if (tab === 'pip') return !!(rawSelectedClip.pipWindowIds?.length || input.isPipClip);

  return tab === 'transform' || tab === 'mask' || tab === 'color' || tab === 'speed' || tab === 'audio' || tab === 'effects';
}

export function getDefaultTabForClipType(
  mediaType: ClipMediaTypeResult,
  input: ClipClassificationInput
): PropertiesTab {
  if (mediaType.isAudioClip || input.selectedTrack?.type === 'audio') {
    return 'audio';
  }
  if (mediaType.isFxClip || input.selectedTrack?.type === 'fx' || input.rawSelectedClip?.fxSettings || input.rawSelectedClip?.particleSettings) {
    return 'effects';
  }
  if (mediaType.isTextClip || input.selectedTrack?.type === 'text' || input.rawSelectedClip?.textSettings) {
    return 'text';
  }
  return 'transform';
}

export function formatClipSubtitle(
  rawSelectedClip: any,
  mediaType: ClipMediaTypeResult,
  selectedMediaItem: any,
  clipDuration: number
): string {
  if (!rawSelectedClip) return 'Controls Inactive';
  const durStr = formatDuration(clipDuration);
  if (mediaType.isAudioClip) {
    return `Audio Track · ${durStr}`;
  }
  if (mediaType.isTextClip) {
    return `Text Layer · ${durStr}`;
  }
  if (mediaType.isFxClip) {
    return `Effect Layer · ${durStr}`;
  }
  const resStr = selectedMediaItem?.height ? `${selectedMediaItem.height}p` : '1080p';
  const aspStr = selectedMediaItem?.width && selectedMediaItem?.height
    ? (Math.abs(selectedMediaItem.width / selectedMediaItem.height - 16 / 9) < 0.1 ? '16:9' : Math.abs(selectedMediaItem.width / selectedMediaItem.height - 9 / 16) < 0.1 ? '9:16' : '1:1')
    : '16:9';
  if (selectedMediaItem?.height) {
    return `${resStr} · ${aspStr} · ${durStr}`;
  }
  return `${aspStr} · ${durStr}`;
}
