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

  async load(preBuffer?: ArrayBuffer | Blob): Promise<void> {
    try {
      let blob: Blob;
      if (preBuffer) {
        blob = preBuffer instanceof Blob ? preBuffer : new Blob([preBuffer]);
      } else {
        const response = await fetch(this.url);
        if (!response.ok) {
          throw new Error(`fetch failed (${response.status})`);
        }
        blob = await response.blob();
      }
      this.bitmap = await createImageBitmap(blob);
      this.ready = true;
    } catch (e: any) {
      this.loadError = `Image decode failed: ${e?.message || e}`;
      console.warn('[StillImageSource]', this.loadError, this.url);
    }
  }

  /**
   * Returns the decoded ImageBitmap directly. Previously this wrapped the bitmap
   * in a VideoFrame which triggered a YUV→RGBA GPU conversion path that is
   * black on some Windows hardware decoders and in OffscreenCanvas 2D contexts.
   * Returning the bitmap itself is a pure CanvasImageSource, so
   * Compositor can draw it with a plain drawImage and never hits the VideoFrame
   * black-screen path.
   *
   * The bitmap is owned by this source; callers must NOT close it — dispose()
   * handles lifetime.
   */
  async getFrameAt(_timestampMicroseconds: number): Promise<CanvasImageSource | null> {
    if (!this.bitmap) return null;
    return this.bitmap;
  }

  dispose() {
    try { this.bitmap?.close(); } catch {}
    this.bitmap = null;
    this.ready = false;
  }
}
