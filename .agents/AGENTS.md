# Antigravity Workspace Rules - Video Editor Project Customizations

This file outlines repository-specific domain knowledge, styling rules, and feature implementations in this video editor project to guide future coding agents.

## 📐 1. Visual Bezier Curve Editor
- **Component**: [BezierCurveEditor.tsx](file:///d:/Video-Editor/src/components/BezierCurveEditor.tsx)
- **Math & Coordinates**:
  - The graph uses a normalized `0-1` space on both axes.
  - The SVG canvas viewport is 140x140 with a padding of 20px on each side.
  - To map graph coords to SVG canvas space, use:
    ```typescript
    const toSvg = (x: number, y: number) => ({
      x: PADDING + x * SIZE,
      y: PADDING + (1 - y) * SIZE // Inverted Y: 0 is bottom (high Y in SVG), 1 is top (low Y in SVG)
    });
    ```
- **Presets & Easing**: Presets are declared in [bezierPresets.ts](file:///d:/Video-Editor/src/utils/bezierPresets.ts) and integrated in clip animations via Zustand store's `addOrUpdateKeyframe`.

---

## 🟢 2. Chroma Key (Green Screen) & Canvas Color Picker
- **Type Settings**:
  - Defined in `ClipChromaKeySettings` inside [types/index.ts](file:///d:/Video-Editor/src/types/index.ts):
    ```typescript
    export interface ClipChromaKeySettings {
      enabled: boolean;
      color: string;             // Hex color, e.g. '#00ff00'
      threshold: number;         // 0 to 100
      softness: number;          // 0 to 100
      spillSuppression?: number; // 0 to 100 (desaturate green/blue fringes)
      edgeFeather?: number;      // 0 to 20 px (Gaussian box blur on alpha)
    }
    ```
- **Canvas Interaction**:
  - The eyedropper captures mouse click events globally on `mousedown` in the capture phase (`true` parameter) to intercept interactions on top of the interactive overlay:
    ```typescript
    document.addEventListener('mousedown', handleMouseDown, true);
    ```
- **Keying Algorithm**:
  - Located in `applyChromaKeyOnData` inside [canvasEffects.ts](file:///d:/Video-Editor/src/utils/canvasEffects.ts).
  - Uses YUV color space transformation (distance in U & V channels) rather than simple RGB Euclidean distance to handle variations in lighting and brightness.
  - **Spill Suppression**: Reduces green/blue reflection on subject borders by scaling back the dominant green/blue channel values on transparent pixels.
  - **Edge Feather**: Smooths out harsh keyed boundaries using a box blur (`blurAlphaChannel`) specifically targeted at the alpha channel.
