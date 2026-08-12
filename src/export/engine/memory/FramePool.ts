export class FramePool {
  private pool: Array<ImageBitmap | VideoFrame> = [];
  private maxSize: number;
  private inUse: Set<ImageBitmap | VideoFrame> = new Set();

  constructor(maxSize: number = 30) {
    this.maxSize = maxSize;
  }

  acquire(): ImageBitmap | VideoFrame | null {
    const available = this.pool.pop();
    if (available) {
      this.inUse.add(available);
      return available;
    }
    return null;
  }

  release(frame: ImageBitmap | VideoFrame) {
    this.inUse.delete(frame);
    if (this.pool.length < this.maxSize) {
      this.pool.push(frame);
    } else {
      (frame as any).close?.(); 
    }
  }

  clear() {
    this.pool.forEach(f => (f as any).close?.());
    this.inUse.forEach(f => (f as any).close?.());
    this.pool = [];
    this.inUse.clear();
  }
}
