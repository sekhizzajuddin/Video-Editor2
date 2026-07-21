const fs = require('fs');

let pc = fs.readFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', 'utf8');

// 1. Add alpha: false to composite canvas getContext
const oldComposite = "compositeCtxRef.current = composite.getContext('2d', { willReadFrequently: !settings.hardwareAcceleration }) || null;";
const newComposite = "compositeCtxRef.current = composite.getContext('2d', { alpha: false, willReadFrequently: !settings.hardwareAcceleration }) || null;";

if (pc.includes(oldComposite)) {
  pc = pc.replace(oldComposite, newComposite);
  console.log('Successfully added alpha: false to composite canvas!');
} else {
  console.log('compositeCtxRef line not matched');
}

// 2. Add isRenderingRef.current = true in tick
const oldTick = "isRendering = true;\n        renderCanvasRef.current()";
const newTick = "isRendering = true;\n        isRenderingRef.current = true;\n        renderCanvasRef.current()";

if (pc.includes(oldTick)) {
  pc = pc.replace(oldTick, newTick);
  console.log('Successfully set isRenderingRef.current = true in tick!');
} else {
  console.log('oldTick not matched');
}

// 3. Conditional lastFrameCanvasRef snapshot (only when !isPlaying)
const oldSnap =     // Snapshot this successfully rendered frame for use during seeking gaps
    if (!lastFrameCanvasRef.current) {
      lastFrameCanvasRef.current = document.createElement('canvas');
    }
    const snapCanvas = lastFrameCanvasRef.current;
    if (snapCanvas.width !== canvas.width || snapCanvas.height !== canvas.height) {
      snapCanvas.width = canvas.width;
      snapCanvas.height = canvas.height;
    }
    const snapCtx = snapCanvas.getContext('2d');
    if (snapCtx) {
      snapCtx.clearRect(0, 0, snapCanvas.width, snapCanvas.height);
      snapCtx.drawImage(composite, 0, 0);
    };

const newSnap =     // Snapshot this successfully rendered frame for use during seeking gaps (only when paused/scrubbing)
    if (!isPlaying) {
      if (!lastFrameCanvasRef.current) {
        lastFrameCanvasRef.current = document.createElement('canvas');
      }
      const snapCanvas = lastFrameCanvasRef.current;
      if (snapCanvas.width !== canvas.width || snapCanvas.height !== canvas.height) {
        snapCanvas.width = canvas.width;
        snapCanvas.height = canvas.height;
      }
      const snapCtx = snapCanvas.getContext('2d');
      if (snapCtx) {
        snapCtx.clearRect(0, 0, snapCanvas.width, snapCanvas.height);
        snapCtx.drawImage(composite, 0, 0);
      }
    };

if (pc.includes(oldSnap)) {
  pc = pc.replace(oldSnap, newSnap);
  console.log('Successfully optimized lastFrameCanvasRef snapshotting!');
} else {
  console.log('oldSnap not matched exactly');
}

// 4. Conditional drawQueue sort
pc = pc.replace('drawQueue.sort((a, b) => a.zIndex - b.zIndex);', 'if (drawQueue.length > 1) drawQueue.sort((a, b) => a.zIndex - b.zIndex);');

fs.writeFileSync('d:/Video-Editor/src/components/PreviewCanvas.tsx', pc);
console.log('Done!');
