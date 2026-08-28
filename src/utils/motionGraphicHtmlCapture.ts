/**
 * HTML/CSS capture engine for motion graphics.
 * Provides DOM isolation, Web Animation API frame-seeking,
 * and high-fidelity SVG foreignObject rasterization.
 */

/**
 * Creates an off-screen, isolated DOM container for rendering HTML/CSS motion graphics scenes.
 */
export function createHiddenContainer(width: number, height: number): HTMLDivElement {
  if (typeof document === 'undefined') {
    return { style: {} } as HTMLDivElement;
  }
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  container.style.zIndex = '-9999';
  
  if (document.body) {
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Removes and cleans up an off-screen container from the DOM.
 */
export function destroyContainer(container: HTMLDivElement): void {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

/**
 * Traverses all CSS / Web Animations in the container's subtree,
 * pauses them, and scrubs their timeline to the exact target millisecond.
 */
export function seekAllAnimations(container: HTMLElement, timeMs: number): void {
  if (!container) return;
  try {
    if (typeof container.getAnimations === 'function') {
      const animations = container.getAnimations({ subtree: true });
      for (const anim of animations) {
        try {
          anim.pause();
          anim.currentTime = timeMs;
        } catch {
          // Silently ignore if individual animation does not support currentTime seeking
        }
      }
    }
  } catch (err) {
    console.warn('[motionGraphicHtmlCapture] seekAllAnimations warning:', err);
  }
}

/**
 * Serializes the container's inner HTML/CSS into an SVG foreignObject,
 * decodes it into an image, and draws it onto the target canvas.
 */
export async function captureFrameToCanvas(
  container: HTMLElement,
  targetCanvas: OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number
): Promise<void> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined' || !container) {
    return;
  }

  let blobUrl: string | null = null;
  try {
    const serializer = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : null;
    let innerContent = '';
    
    // Serialize all children to ensure valid XML compliant syntax
    if (serializer && container.childNodes && container.childNodes.length > 0) {
      for (let i = 0; i < container.childNodes.length; i++) {
        innerContent += serializer.serializeToString(container.childNodes[i]);
      }
    } else {
      innerContent = container.innerHTML || '';
    }

    // Wrap in standard SVG foreignObject with XHTML namespace
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;box-sizing:border-box;margin:0;padding:0;">
      ${innerContent}
    </div>
  </foreignObject>
</svg>`;

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    blobUrl = URL.createObjectURL(svgBlob);

    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load foreignObject SVG image'));
      img.src = blobUrl!;
    });

    const ctx = targetCanvas.getContext('2d') as (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null);
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
    }
  } catch (error) {
    // Fallback: draw a subtle placeholder indicating render fault
    const ctx = targetCanvas.getContext('2d') as (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null);
    if (ctx && typeof ctx.save === 'function') {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.fillRect(10, 10, width - 20, height - 20);
      ctx.strokeRect(10, 10, width - 20, height - 20);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('HTML Scene render fallback', 30, 50);
      ctx.restore();
    }
  } finally {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }
}
