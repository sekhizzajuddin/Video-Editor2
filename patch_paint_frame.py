import re
import sys

with open('d:/Video-Editor/src/utils/motionGraphicRenderer.ts', 'r', encoding='utf-8') as f:
    content = f.read()

OLD_PAINT_FRAME = """  // (c) Canvas 2D components (KineticWord, VectorShape, …).
  for (const element of canvasElements) {
    if (timeSec < element.enterAt || timeSec > element.exitAt) continue;
    ctx.save();
    if (element.position) {
      ctx.translate(element.position.x, element.position.y);
    }
    const localTime = timeSec - element.enterAt;
    const elementDuration = Math.max(0.001, element.exitAt - element.enterAt);
    try {
      drawComponent(
        element.component,
        ctx as any,
        element.config,"""

NEW_PAINT_FRAME = """  // (c) Canvas 2D components (KineticWord, VectorShape, …).
  for (const element of canvasElements) {
    if (timeSec < element.enterAt || timeSec > element.exitAt) continue;
    ctx.save();
    
    // Inject the root position into config so components can read it
    if (element.position) {
      if (!element.config) element.config = {};
      element.config.position = element.position;
    }
    
    const localTime = timeSec - element.enterAt;
    const elementDuration = Math.max(0.001, element.exitAt - element.enterAt);
    try {
      drawComponent(
        element.component,
        ctx as any,
        element.config,"""

if OLD_PAINT_FRAME in content:
    content = content.replace(OLD_PAINT_FRAME, NEW_PAINT_FRAME)
    with open('d:/Video-Editor/src/utils/motionGraphicRenderer.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched motionGraphicRenderer.ts to fix translation bug")
else:
    print("OLD_PAINT_FRAME not found!")
