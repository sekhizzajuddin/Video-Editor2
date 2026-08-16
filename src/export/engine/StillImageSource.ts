/**
 * StillImageSource
 *
 * Frame source for image clips (PNG / JPEG / WebP / GIF-first-frame) on video
 * tracks. Interface-compatible with AssetDecoder so FrameScheduler can treat
 * every clip the same way.
 *
 * WHY THIS EXISTS (export-black-frames fix):
 * The export FrameScheduler used to route EVERY clip URL into AssetDecoder,
 * which is an MP4 (ISO-BMFF) demuxer. Image files failed to parse, getFrameAt()
 * returned null, no layer was composited and the exported video was solid
 * black — while the audio mix (decoded via decodeAudioData) still worked. That
 * is exactly the reported "export is blank black, only audio" bug for any
 * timeline containing photos/graphics.
 */
export class StillImageSource {
  /** Matches AssetDecoder's public surface. Images carry no container rotation. */
  public rotation: number = 0;
  /** True once the bitmap decoded successfully. */
  public ready: boolean = false;
  /** Human-readable reason when ready === false. */
  public loadError: string | null = null;

  private url: string;
  private bitmap: ImageBitmap | null = null;

  constructor(url: string) {
    this.url = url;
  }

  async load(): Promise<void> {
    try {
      const response = await fetch(this.url);
      if (!response.ok) {
        throw new Error(`fetch failed (${response.status})`);
      }
      const blob = await response.blob();
      this.bitmap = await createImageBitmap(blob);
      this.ready = true;
    } catch (e: any) {
      this.loadError = `Image decode failed: ${e?.message || e}`;
      console.warn('[StillImageSource]', this.loadError, this.url);
    }
  }

  /**
   * Returns a fresh VideoFrame wrapping the decoded bitmap. The caller owns the
   * returned frame and must close() it (the export loop already does); the
   * underlying bitmap is retained until dispose().
   */
  async getFrameAt(_timestampMicroseconds: number): Promise<VideoFrame | null> {
    if (!this.bitmap) return null;
    try {
      return new VideoFrame(this.bitmap, { timestamp: 0 });
    } catch (e: any) {
      console.warn('[StillImageSource] VideoFrame wrap failed:', e?.message);
      return null;
    }
  }

  dispose() {
    try { this.bitmap?.close(); } catch {}
    this.bitmap = null;
    this.ready = false;
  }
}
