/**
 * previewMath.ts
 * 
 * Math coordinate transformation functions and pixel manipulation utilities for Preview Canvas.
 * 
 * Connected to:
 * - PropertyPanel: Transform values (scale, x, y, rotation) and keyframe animations.
 * - Timeline: Current time position for keyframe animation interpolation.
 * - InteractiveCanvasOverlay: Screen <-> Image pixel coordinate mapping for mask drawing & crop handles.
 */

import { getAnimatedValue } from '@/utils/keyframes';
import { useEditorStore } from '@/store/editorStore';
import { getSentenceBounds } from '@/utils/kineticSync';

/**
 * Helper to get active perRatioFraming adjustments for a clip
 */
function getPerRatioFraming(clipId: string, aX: number, aY: number, aScale: number) {
  try {
    const state = useEditorStore.getState();
    if (state.perRatioFramingEnabled && state.perRatioFraming[state.aspectRatio]?.[clipId]) {
      const framing = state.perRatioFraming[state.aspectRatio][clipId];
      if (framing.x !== undefined) aX += framing.x;
      if (framing.y !== undefined) aY += framing.y;
      if (framing.scale !== undefined) aScale *= (framing.scale / 100);
    }
  } catch (e) {
    // ignore outside store context
  }
  return { aX, aY, aScale };
}



/**
 * Map the preview container's client box onto the 854x480 overlay coordinate
 * space, accounting for letterboxing.
 *
 * The preview <canvas> is rendered with `object-contain` and the overlay <svg>
 * uses `viewBox="0 0 854 480"` with the default `preserveAspectRatio` — both
 * therefore letterbox: they scale UNIFORMLY and centre, leaving bars on whichever
 * axis has spare room.
 *
 * The pointer maths, however, used `854 / rect.width` and `480 / rect.height`
 * independently. Whenever the container's aspect ratio differed from 16:9 (which
 * is most of the time, since the preview pane is freely resizable) those two
 * factors disagreed with the single factor the browser actually applied. The
 * result: dragging a clip moved it at the wrong speed, faster on one axis than
 * the other, and handles drifted away from the pointer — the "buggy transform
 * box" seen on every media type.
 *
 * Returns the uniform scale plus the letterbox offsets, so callers can convert
 * both deltas and absolute positions correctly.
 */
export function getOverlayMapping(rect: { width: number; height: number }): {
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  const VIEW_W = 854;
  const VIEW_H = 480;
  if (!rect.width || !rect.height) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  // `object-contain` / `xMidYMid meet` == fit entirely inside, preserving ratio.
  const displayScale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
  const drawnW = VIEW_W * displayScale;
  const drawnH = VIEW_H * displayScale;
  return {
    // Multiply a CLIENT-pixel delta by this to get an overlay-unit delta.
    scale: displayScale > 0 ? 1 / displayScale : 1,
    // Client-pixel offset of the drawn area's top-left corner.
    offsetX: (rect.width - drawnW) / 2,
    offsetY: (rect.height - drawnH) / 2,
  };
}

/**
 * Convert a client (mouse) position into overlay 854x480 coordinates.
 */
export function clientToOverlay(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = getOverlayMapping(rect);
  return {
    x: (clientX - rect.left - offsetX) * scale,
    y: (clientY - rect.top - offsetY) * scale,
  };
}


/**
 * Convert a client (mouse) position into the CLIP-LOCAL coordinate space that the
 * transform handles live in.
 *
 * The overlay renders handles inside a nested transform:
 *
 *   translate(totalX, totalY) scale(zoom) translate(offsetX, offsetY)
 *     -> translate(W/2 + aX, H/2 + aY) rotate(aRot) scale(aScale/100)
 *
 * `clientToOverlay` only undoes the letterboxing, giving RAW 854x480 units. The
 * rotation and corner-resize handlers then compared that against a hard-coded
 * centre of (427 + x, 240 + y), which silently assumes zoom = 1 and pan = 0.
 *
 * With any zoom or pan, the measured distance from the centre was wrong the
 * instant the handle was grabbed — so the very first mousemove snapped the clip to
 * a different scale (e.g. 125% at 1.25x zoom, 182% at 1.5x zoom with pan) before
 * the user had meaningfully moved the pointer. Dragging showed the same symptom as
 * a position jump. This undoes the viewport transform so the comparison happens in
 * the space the handles are actually drawn in.
 */
export function clientToViewportSpace(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  viewport: { x: number; y: number; zoom: number }
): { x: number; y: number } {
  const raw = clientToOverlay(clientX, clientY, rect);
  const zoom = viewport.zoom || 1;
  const cx = 854 / 2;
  const cy = 480 / 2;
  // Inverse of: translate(totalX, totalY) scale(zoom)
  const totalX = cx + viewport.x - cx * zoom;
  const totalY = cy + viewport.y - cy * zoom;
  return {
    x: (raw.x - totalX) / zoom,
    y: (raw.y - totalY) / zoom,
  };
}

/**
 * Extent of a Hybrid kinetic sentence, measured from its per-word PiP layers.
 * Returns null for any clip that is not such a container.
 */
function getKineticSentenceExtent(
  clip: any
): { width: number; height: number } | null {
  if (typeof clip?.mediaId !== 'string' || !clip.mediaId.startsWith('generator:kinetic')) return null;
  const pipId = clip.pipWindowIds?.[0];
  if (!pipId) return null;

  try {
    const pip = (useEditorStore.getState().pipWindows || {})[pipId];
    if (!pip) return null;

    const laid: { text: string; x: number; y: number; fontSize: number }[] = [];
    for (const track of pip.tracks || []) {
      if (track.type !== 'text') continue;
      const wc = track.clips?.[0];
      if (!wc) continue;
      laid.push({
        text: String(wc.textSettings?.text || ''),
        x: wc.transform?.x ?? 0,
        y: wc.transform?.y ?? 0,
        fontSize: Number(wc.textSettings?.fontSize) || 48,
      });
    }
    return getSentenceBounds(laid);
  } catch {
    return null;
  }
}

/**
 * Calculates base and scaled dimensions for a given clip based on media type & viewport size.
 */
export function getClipDimensions(
  clip: any,
  mediaLibrary: any[],
  W: number,
  H: number
): { width: number; height: number } {
  if (!clip) return { width: 0, height: 0 };
  const mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) || null;
  let vw = W;
  let vh = H;
  
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    vw = mediaItem.width || 1920;
    vh = mediaItem.height || 1080;
  } else if (mediaItem?.type === 'text' || clip.textSettings || clip.mediaId === 'text-placeholder') {
    const ts = clip.textSettings;

    // Hybrid kinetic sentences use an INVISIBLE primary clip (fontSize 1,
    // transparent) purely as a container for their per-word PiP layers. Its own
    // text metrics describe neither what is drawn nor where: the visible words
    // live in the PiP window and are already wrapped across several lines.
    // Measure those word layers so the box matches the block the user sees.
    const kineticBounds = getKineticSentenceExtent(clip);
    if (kineticBounds) {
      // Word transforms are stored UNSCALED and container-relative, so this is
      // already the BASE extent; the `scale / 100` applied at the end of this
      // function is the one and only scaling.
      vw = Math.max(80, kineticBounds.width + 40);
      vh = Math.max(40, kineticBounds.height + 20);
    } else if (ts) {
      const fontSize = Number(ts.fontSize) || 48;
      const text = String(ts.text || '');
      const lines = text.split('\n');
      const estCharWidth = fontSize * 0.75;
      const longestLine = lines.reduce((max: number, l: string) => Math.max(max, l.length), 0);
      const bgPad = (ts.backgroundColor && ts.backgroundColor !== 'transparent') ? fontSize * 0.5 * 2 : 0;
      const strokePad = (ts.strokeColor && ts.strokeWidth) ? Number(ts.strokeWidth) * 2 : 0;
      const shadowPad = ts.shadow ? (Number(ts.shadowBlur) || 10) * 2 + 10 : 0;
      vw = Math.max(80, Math.ceil(longestLine * estCharWidth + bgPad + strokePad + shadowPad + 40));
      vh = Math.max(40, Math.ceil(lines.length * (fontSize * 1.35) + bgPad + strokePad + shadowPad + 20));
    } else {
      vw = 300;
      vh = 80;
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / (vw || 1), H / (vh || 1));
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;
  
  let scale = clip.transform?.scale ?? 100;
  const framed = getPerRatioFraming(clip.id, 0, 0, scale);
  scale = framed.aScale;

  return {
    width: baseW * (scale / 100),
    height: baseH * (scale / 100),
  };
}

/**
 * Maps screen coordinates (mouse/touch position) to unscaled clip image space coordinates.
 */
export function screenToImageCoords(
  mx: number,
  my: number,
  clip: any,
  baseW: number,
  baseH: number,
  currentTime: number
) {
  let aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
  let aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
  let aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

  const framed = getPerRatioFraming(clip.id, aX, aY, aScale);
  aX = framed.aX;
  aY = framed.aY;
  aScale = framed.aScale;

  // 1. Translate back by clip center offset
  const tx = mx - aX;
  const ty = my - aY;

  // 2. Rotate back by negative rotation
  const theta = (-aRot * Math.PI) / 180;
  const rx = tx * Math.cos(theta) - ty * Math.sin(theta);
  const ry = tx * Math.sin(theta) + ty * Math.cos(theta);

  // 3. Scale back
  const sf = aScale / 100 || 1;
  const imgX = rx / sf;
  const imgY = ry / sf;

  // 4. Map from center-origin to top-left of image space
  return {
    x: imgX + baseW / 2,
    y: imgY + baseH / 2
  };
}

/**
 * Maps unscaled clip image space coordinates to screen viewport coordinates.
 */
export function imageToScreenCoords(
  ix: number,
  iy: number,
  clip: any,
  baseW: number,
  baseH: number,
  currentTime: number
) {
  let aX = getAnimatedValue(clip.transform.x, currentTime, clip.startTime, clip.animations?.['transform.x']);
  let aY = getAnimatedValue(clip.transform.y, currentTime, clip.startTime, clip.animations?.['transform.y']);
  let aScale = getAnimatedValue(clip.transform.scale, currentTime, clip.startTime, clip.animations?.['transform.scale']);
  const aRot = getAnimatedValue(clip.transform.rotation, currentTime, clip.startTime, clip.animations?.['transform.rotation']);

  const framed = getPerRatioFraming(clip.id, aX, aY, aScale);
  aX = framed.aX;
  aY = framed.aY;
  aScale = framed.aScale;

  // 1. Map to center-origin
  const cx = ix - baseW / 2;
  const cy = iy - baseH / 2;

  // 2. Scale
  const sf = aScale / 100 || 1;
  const sx = cx * sf;
  const sy = cy * sf;

  // 3. Rotate
  const theta = (aRot * Math.PI) / 180;
  const rx = sx * Math.cos(theta) - sy * Math.sin(theta);
  const ry = sx * Math.sin(theta) + sy * Math.cos(theta);

  // 4. Translate
  return {
    x: rx + aX,
    y: ry + aY
  };
}

/**
 * High-performance flood fill algorithm for magic wand selection on canvas ImageData.
 */
export function floodFill(
  imgData: ImageData,
  startX: number,
  startY: number,
  tolerance: number = 30
): Uint8ClampedArray {
  const w = imgData.width;
  const h = imgData.height;
  const pixels = imgData.data;
  const visited = new Uint8Array(w * h);
  const mask = new Uint8ClampedArray(w * h);

  const sx = Math.max(0, Math.min(w - 1, Math.floor(startX)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(startY)));

  const targetIdx = (sy * w + sx) * 4;
  const targetR = pixels[targetIdx];
  const targetG = pixels[targetIdx + 1];
  const targetB = pixels[targetIdx + 2];
  const targetA = pixels[targetIdx + 3];

  const queue: [number, number][] = [[sx, sy]];
  let head = 0;
  visited[sy * w + sx] = 1;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = cy * w + cx;
    mask[idx] = 255;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          const pIdx = nIdx * 4;
          const dr = pixels[pIdx] - targetR;
          const dg = pixels[pIdx + 1] - targetG;
          const db = pixels[pIdx + 2] - targetB;
          const da = pixels[pIdx + 3] - targetA;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
          if (dist <= tolerance) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }
  return mask;
}

/**
 * Fast multi-pass color-diffusion inpainting for erasing masked regions in ImageData.
 */
export function inpaint(imageData: ImageData, maskData: Uint8ClampedArray) {
  const w = imageData.width;
  const h = imageData.height;
  const pixels = imageData.data;
  const src = new Uint8ClampedArray(pixels);

  for (let iter = 0; iter < 18; iter++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const maskIdx = y * w + x;

        if (maskData[maskIdx] > 128) {
          let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
          let count = 0;

          const neighborCoords = [
            [Math.max(0, y - 1), x],
            [Math.min(h - 1, y + 1), x],
            [y, Math.max(0, x - 1)],
            [y, Math.min(w - 1, x + 1)]
          ];

          neighborCoords.forEach(([ny, nx]) => {
            const nIdx = (ny * w + nx) * 4;
            const nMIdx = ny * w + nx;
            if (maskData[nMIdx] <= 128) {
              rSum += src[nIdx];
              gSum += src[nIdx + 1];
              bSum += src[nIdx + 2];
              aSum += src[nIdx + 3];
              count++;
            }
          });

          if (count > 0) {
            pixels[idx] = rSum / count;
            pixels[idx + 1] = gSum / count;
            pixels[idx + 2] = bSum / count;
            pixels[idx + 3] = aSum / count;
          } else {
            let rSumAll = 0, gSumAll = 0, bSumAll = 0, aSumAll = 0;
            neighborCoords.forEach(([ny, nx]) => {
              const nIdx = (ny * w + nx) * 4;
              rSumAll += pixels[nIdx];
              gSumAll += pixels[nIdx + 1];
              bSumAll += pixels[nIdx + 2];
              aSumAll += pixels[nIdx + 3];
            });
            pixels[idx] = rSumAll / 4;
            pixels[idx + 1] = gSumAll / 4;
            pixels[idx + 2] = bSumAll / 4;
            pixels[idx + 3] = aSumAll / 4;
          }
        }
      }
    }
    src.set(pixels);
  }
}
