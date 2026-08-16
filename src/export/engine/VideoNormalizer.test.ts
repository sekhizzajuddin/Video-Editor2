import { describe, it, expect } from 'vitest';
import { isIsoBmff } from './VideoNormalizer';

/**
 * Container sniffing is what decides whether a media file goes straight to the
 * worker's MP4 demuxer or gets transcoded first. Getting this wrong reproduces
 * the "export is black, audio only" bug, so lock the check in.
 */
describe('isIsoBmff', () => {
  const ftyp = (brand: string) => {
    const bytes = new Uint8Array(16);
    // size (4 bytes) then 'ftyp'
    bytes.set([0x00, 0x00, 0x00, 0x18], 0);
    bytes.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
    for (let i = 0; i < 4; i++) bytes[8 + i] = brand.charCodeAt(i);
    return bytes;
  };

  it('accepts MP4 files (isom brand)', () => {
    expect(isIsoBmff(ftyp('isom'))).toBe(true);
  });

  it('accepts QuickTime MOV files (qt brand)', () => {
    expect(isIsoBmff(ftyp('qt  '))).toBe(true);
  });

  it('rejects WebM/Matroska (EBML magic)', () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81]);
    expect(isIsoBmff(webm)).toBe(false);
  });

  it('rejects PNG images', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
    expect(isIsoBmff(png)).toBe(false);
  });

  it('rejects Ogg', () => {
    const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0, 0, 0, 0, 0, 0]);
    expect(isIsoBmff(ogg)).toBe(false);
  });

  it('rejects buffers that are too short', () => {
    expect(isIsoBmff(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74]))).toBe(false);
  });
});
