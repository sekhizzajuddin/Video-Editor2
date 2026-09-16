/**
 * Video codec support policy (preview side).
 *
 * A browser only decodes the codecs its platform ships. HEVC/H.265 is the one
 * that matters in practice: iPhones, most Android phones and many mirrorless
 * cameras record it by default, and a desktop Chrome/Firefox without HEVC
 * hardware support cannot decode it at all.
 *
 * When that happens the `<video>` element is not broken in any way the editor
 * can observe: `loadedmetadata` fires, `duration` is correct, `readyState`
 * reaches HAVE_ENOUGH_DATA, `paused` is false and `currentTime` even advances —
 * but `videoWidth`/`videoHeight` are 0 and not a single frame is ever decoded.
 * The clip therefore renders as an empty layer while every health check in the
 * app (pool element counts, buffering predicate, transport) says the media is
 * fine, and the export path fails separately with a generic WebCodecs error.
 *
 * This module turns that silent failure into an explicit, actionable message.
 * It is deliberately free of DOM and library dependencies so the decision can
 * be unit-tested directly.
 */

/** Codec ids as reported by mediabunny (`videoTrack.getCodec()`) → display name. */
export const CODEC_LABELS: Readonly<Record<string, string>> = {
  hevc: 'HEVC/H.265',
  h265: 'HEVC/H.265',
  avc: 'H.264/AVC',
  h264: 'H.264/AVC',
  vp8: 'VP8',
  vp9: 'VP9',
  av1: 'AV1',
  prores: 'ProRes',
  mpeg4: 'MPEG-4',
  theora: 'Theora',
};

/** Human-readable name for a codec id, or `null` when unknown. */
export function codecLabel(codec: string | null | undefined): string | null {
  if (!codec) return null;
  const key = String(codec).trim().toLowerCase();
  if (!key) return null;
  const known = CODEC_LABELS[key];
  if (known) return known;
  // Unknown but non-empty: show the raw id so the user can search for it.
  return key.toUpperCase();
}

/** Short badge text (tooltips carry the full message). */
export function shortCodecWarning(codec: string | null | undefined): string {
  const label = codecLabel(codec);
  return label ? `${label} not supported` : 'Codec not supported';
}

/**
 * Full, actionable message for a video the browser cannot decode.
 * Names the codec when known and always says what to do about it.
 */
export function undecodableVideoMessage(codec: string | null | undefined): string {
  const label = codecLabel(codec);
  const subject = label ? `${label} video` : 'This video';
  const escape = label === 'HEVC/H.265'
    // HEVC is the one codec with a realistic "use a different browser" escape
    // hatch — Safari and Edge/Chrome with hardware HEVC support play it fine.
    ? ' Convert it to H.264/MP4, or open the project in Safari, or in Edge/Chrome with HEVC hardware decoding.'
    : ' Convert it to H.264/MP4 — that codec plays in every browser.';
  return `${subject} can't be decoded by this browser, so the clip stays black in the preview `
    + `and its frames are missing from exports.${escape}`;
}

export interface ProbedVideoInfo {
  /** `HTMLVideoElement.videoWidth` after `loadedmetadata`. */
  width?: number | null;
  /** `HTMLVideoElement.videoHeight` after `loadedmetadata`. */
  height?: number | null;
  /** Container codec id, when it could be inspected. */
  codec?: string | null;
  /** False when the container has no video track at all (audio-only MP4). */
  hasVideoTrack?: boolean;
}

export interface DecodeVerdict {
  /** True when the element reported real frame dimensions. */
  supported: boolean;
  /** Actionable explanation — only present when `supported` is false. */
  issue?: string;
  /** Codec id from the inspection, when one was available. */
  codec?: string | null;
}

/**
 * Decide whether a probed video can actually produce frames.
 *
 * Dimensions are the signal: `loadedmetadata` guarantees `videoWidth` reflects
 * the decoded stream, so 0×0 means "the browser understood the container but
 * could not describe (let alone decode) the video track" — which is exactly the
 * unsupported-codec case. The one other way to get 0×0 is a file with no video
 * track at all, which deserves its own message rather than a codec lecture.
 */
export function assessProbedVideo(info: ProbedVideoInfo): DecodeVerdict {
  const width = Number(info.width) || 0;
  const height = Number(info.height) || 0;
  if (width > 0 && height > 0) return { supported: true };
  if (info.hasVideoTrack === false) {
    return {
      supported: false,
      codec: null,
      issue: 'This file contains no video track, so there is nothing to render — only its audio can be used.',
    };
  }
  return { supported: false, codec: info.codec ?? null, issue: undecodableVideoMessage(info.codec) };
}

/**
 * Export-side equivalent: WebCodecs can fail on a file the preview plays fine
 * (HEVC without hardware encoding support, or before a decoder is available).
 */
export function undecodableExportMessage(codec: string | null | undefined): string {
  const label = codecLabel(codec);
  return `Codec not supported by browser WebCodecs${label ? ` (${label})` : ''}`;
}
