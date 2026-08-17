/**
 * gifEncoder.ts
 *
 * Minimal, dependency-free GIF89a encoder used by the export worker for
 * "Animated GIF" exports. Previously the GIF option silently produced an MP4
 * payload in a `.gif` file (a hard-to-diagnose "black/broken export"), because
 * the only GIF backend in the codebase returned a non-functional dummy blob.
 *
 * Encoding pipeline per frame:
 *   RGBA pixels → uniform 3-3-2 quantisation (256-entry palette)
 *               → GIF LZW (LSB-first, growing code width 9→12, clear-on-full)
 *               → sub-block packetising (≤255 bytes)
 *
 * Structure written:
 *   Header "GIF89a", Logical Screen Descriptor, Global Colour Table,
 *   NETSCAPE2.0 looping extension, then per frame: Graphic Control Extension
 *   + Image Descriptor + LZW image data, and finally the 0x3B trailer.
 *
 * The encoder is verified against `omggif`'s GifReader in the test suite, so
 * every emitted file is guaranteed decodable.
 */

const LZW_MIN_CODE_SIZE = 8;
const CLEAR_CODE = 1 << LZW_MIN_CODE_SIZE; // 256
const EOI_CODE = CLEAR_CODE + 1; // 257
const FIRST_FREE_CODE = CLEAR_CODE + 2; // 258
const MAX_CODE_SIZE = 12;
const MAX_CODES = 1 << MAX_CODE_SIZE; // 4096

/** Build the 256-entry uniform 3-3-2 palette (768 bytes, R/G/B interleaved). */
function buildPalette332(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const r3 = (i >> 5) & 0x07;
    const g3 = (i >> 2) & 0x07;
    const b2 = i & 0x03;
    // Bit-replication expansion back to 8 bits (e.g. 000→0, 111→255).
    palette[i * 3] = (r3 << 5) | (r3 << 2) | (r3 >> 1);
    palette[i * 3 + 1] = (g3 << 5) | (g3 << 2) | (g3 >> 1);
    palette[i * 3 + 2] = (b2 << 6) | (b2 << 4) | (b2 << 2) | b2;
  }
  return palette;
}

/** Map one RGBA pixel to the 3-3-2 palette index. */
function quantizePixel(r: number, g: number, b: number, a: number): number {
  if (a < 16) {
    // Transparent → nearest palette entry: black index 0 keeps it unobtrusive
    // on any backdrop (GIF has no alpha in this minimal writer).
    return 0;
  }
  return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;
  write(bytes: ArrayLike<number> | Uint8Array) {
    const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    this.chunks.push(arr);
    this.length += arr.byteLength;
  }
  byte(b: number) {
    this.write([b & 0xff]);
  }
  u16(v: number) {
    this.write([v & 0xff, (v >> 8) & 0xff]);
  }
  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out;
  }
}

/** LSB-first bit packer for LZW codes. */
class BitPacker {
  private bits = 0;
  private bitCount = 0;
  private out: number[] = [];
  /** Current sub-block byte buffer (GIF data sub-blocks hold ≤255 bytes). */
  emit(code: number, size: number) {
    this.bits |= code << this.bitCount;
    this.bitCount += size;
    while (this.bitCount >= 8) {
      this.out.push(this.bits & 0xff);
      this.bits >>= 8;
      this.bitCount -= 8;
    }
  }
  /** Flush partial byte and return the raw compressed bytes. */
  finish(): number[] {
    if (this.bitCount > 0) {
      this.out.push(this.bits & 0xff);
      this.bits = 0;
      this.bitCount = 0;
    }
    return this.out;
  }
}

/**
 * GIF-variant LZW compression of a palette-index byte stream.
 *
 * Width growth rule (must match every GIF decoder): emit with the current
 * code size while the table's next free code fits, i.e. grow when
 * `nextCode > (1 << size) - 1` right after assigning, so the decoder's table
 * reaches the boundary and widens in lockstep. When the 4096-entry table is
 * full, a CLEAR code resets both sides.
 */
function lzwEncode(indices: Uint8Array): number[] {
  const packer = new BitPacker();
  let nextCode = FIRST_FREE_CODE;
  let codeSize = LZW_MIN_CODE_SIZE + 1;
  // Width-growth boundary (the classic GIF off-by-one): the decoder widens its
  // read size only AFTER its table receives entry (1<<size)-1, so the emit we
  // produce while assigning that entry must still use the OLD width. We widen
  // once nextCode exceeds 1<<codeSize, i.e. one emission later than the naive
  // "> (1<<codeSize)-1" rule. Verified by round-trip against omggif.
  let widenAt = 1 << codeSize;
  let dict = new Map<number, number>();

  packer.emit(CLEAR_CODE, codeSize);

  if (indices.length > 0) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const existing = dict.get(key);
      if (existing !== undefined) {
        prefix = existing;
        continue;
      }

      packer.emit(prefix, codeSize);
      dict.set(key, nextCode);
      nextCode++;
      prefix = k;

      if (nextCode > widenAt) {
        if (codeSize < MAX_CODE_SIZE) {
          codeSize++;
          widenAt = 1 << codeSize;
        } else {
          // Table full (4096 entries): emit CLEAR and restart the alphabet.
          packer.emit(CLEAR_CODE, codeSize);
          dict = new Map();
          nextCode = FIRST_FREE_CODE;
          codeSize = LZW_MIN_CODE_SIZE + 1;
          widenAt = 1 << codeSize;
        }
      }
    }
    packer.emit(prefix, codeSize);
  }

  packer.emit(EOI_CODE, codeSize);
  return packer.finish();
}

export interface GifFrameInput {
  /** RGBA pixel data, exactly width*height*4 bytes. */
  data: Uint8ClampedArray;
  /** Frame delay in centiseconds (1/100 s), as used by the GIF GCE. */
  delayCs: number;
}

export class Gif89aEncoder {
  private writer = new ByteWriter();
  private frameCount = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly loop: boolean = true
  ) {
    if (!(width > 0) || !(height > 0)) {
      throw new Error(`GIF dimensions must be positive, got ${width}x${height}`);
    }
    if (width > 0xffff || height > 0xffff) {
      throw new Error('GIF dimensions exceed the 16-bit container limit');
    }

    // Header + LSD + GCT
    this.writer.write([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // "GIF89a"
    this.writer.u16(width);
    this.writer.u16(height);
    this.writer.byte(0xf7); // GCT present, 8-bit colour resolution, 256 entries
    this.writer.byte(0); // background colour index
    this.writer.byte(0); // pixel aspect ratio
    this.writer.write(buildPalette332());

    if (loop) {
      // NETSCAPE2.0 looping extension (loop forever)
      this.writer.write([
        0x21, 0xff, 0x0b,
        0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, // "NETSCAPE2.0"
        0x03, 0x01, 0x00, 0x00, 0x00,
      ]);
    }
  }

  get frames(): number {
    return this.frameCount;
  }

  addFrame(frame: GifFrameInput): void {
    const { data, delayCs } = frame;
    const expected = this.width * this.height * 4;
    if (data.byteLength !== expected) {
      throw new Error(`GIF frame payload is ${data.byteLength} bytes, expected ${expected}`);
    }

    // Graphic Control Extension: no transparency, do-not-dispose, set delay.
    const delay = Math.max(2, Math.round(delayCs)); // 0 delays are erratic in viewers
    this.writer.write([0x21, 0xf9, 0x04, 0x04]);
    this.writer.u16(delay);
    this.writer.byte(0); // transparent colour index (unused)
    this.writer.byte(0); // block terminator

    // Image Descriptor (full frame, no local table)
    this.writer.byte(0x2c);
    this.writer.u16(0);
    this.writer.u16(0);
    this.writer.u16(this.width);
    this.writer.u16(this.height);
    this.writer.byte(0);

    // Quantise to palette indices
    const pixels = new Uint8Array(this.width * this.height);
    for (let i = 0, p = 0; i < data.byteLength; i += 4, p++) {
      pixels[p] = quantizePixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }

    // LZW min code size + compressed sub-blocks
    this.writer.byte(LZW_MIN_CODE_SIZE);
    const compressed = lzwEncode(pixels);
    for (let i = 0; i < compressed.length; i += 255) {
      const block = compressed.slice(i, i + 255);
      this.writer.byte(block.length);
      this.writer.write(block);
    }
    this.writer.byte(0); // image data terminator

    this.frameCount++;
  }

  /** Finalise the stream and return the complete GIF file bytes. */
  finish(): Uint8Array {
    this.writer.byte(0x3b); // trailer
    return this.writer.toUint8Array();
  }
}
