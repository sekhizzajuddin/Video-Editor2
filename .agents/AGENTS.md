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

---

## 🎙️ 3. Teleprompter Studio Pro & Studio Mic DSP
- **Component**: [TeleprompterModal.tsx](file:///d:/Video-Editor/src/components/TeleprompterModal.tsx)
- **Speech Tracking & Token Matching**:
  - Located in [teleprompterSpeechTracker.ts](file:///d:/Video-Editor/src/utils/teleprompterSpeechTracker.ts).
  - Uses continuous, interim-result Web Speech API with fallback auto-pacer.
  - Performs multi-tier fuzzy matching (exact, contraction normalization, prefix, Levenshtein edit distance <= 1-2).
  - Progressively highlights spoken words (emerald) and active focus words (amber glow) with automatic sentence-by-sentence slide advance upon completion.
- **Studio Mic DSP Engine**:
  - Located in [studioMicProcessor.ts](file:///d:/Video-Editor/src/utils/studioMicProcessor.ts).
  - Cascaded 18dB/octave high-pass de-rumble (80Hz), dynamic noise gate (-42dB), multi-band acoustic EQ (warmth at 160Hz, boxiness cut at 480Hz, presence at 3.2kHz, de-esser at 6.8kHz, air at 11kHz), dynamics compressor, analog tube saturation, and limiter.
  - Presets: Shure SM7B Studio Podcaster, Broadcast Radio, Warm Voiceover, Crisp Clarity, Clean Denoise, Bypass.
- **Post-Recording Smoothing**:
  - Located in [dialogueSmoothing.ts](file:///d:/Video-Editor/src/utils/dialogueSmoothing.ts).
  - Uses Groq Whisper for word-level alignment & filler word detection, Gemini Flash for voice directing & coaching, and Web Audio PCM buffer splicing for smart silence/dead-air tightening.

---

## 📹 4. Studio Camera Enhancer & 4K Super-Resolution Upscaler
- **Real-Time Video Enhancer**:
  - Located in [studioVideoEnhancer.ts](file:///d:/Video-Editor/src/utils/studioVideoEnhancer.ts).
  - YCbCr skin tone detection (`Cb` in 77..135, `Cr` in 130..175, `Y` > 35) with selective bilateral smoothing (blurs blemishes and acne while preserving sharp eyes/lips/hair).
  - **Indian & Brown Skin Tone Detection**: `isIndianOrBrownSkin(r, g, b, y, cb, cr)` specifically models melanin-rich Fitzpatrick III–VI skin profiles ($Y \in [18, 225]$, $Cb \in [62, 138]$, $Cr \in [122, 186]$, $Cr - Cb \ge 8$, $R > G > B$). Smooths blemishes and elevates golden bronze radiance while strictly preventing bleaching or ashy cast.
  - Face tone radiance glow (healthy warm peach/gold luster).
  - Low-light shadow sensor de-noiser (cleans dark webcam chroma speckles).
  - Studio key-light / ring-light radial illumination and S-curve contrast mapper.
  - Presets: Studio Broadcast Pro, Indian Warm Radiance (`indian-radiance`), Soft Beauty Glow, Low-Light Rescue, Crisp 4K Detail, Bypass.
- **Physical SSD Recording Storage (Safety First)**:
  - Located in [ssdRecordingStorage.ts](file:///d:/Video-Editor/src/utils/ssdRecordingStorage.ts).
  - Immediately writes raw media chunks to local physical SSD via IndexedDB (`procut_ssd_recordings_v1`) and automatically triggers direct disk download (`a.download`).
  - Clears RAM-bound object references so high-memory 4K upscaling never runs out of memory or crashes low-end PCs.
- **AI 4K Super-Resolution & Clarity Remastering (< 400 MB GPU VRAM Guard)**:
  - Located in [videoUpscaler.ts](file:///d:/Video-Editor/src/utils/videoUpscaler.ts).
  - Strictly guarantees $< 400\text{ MB}$ GPU VRAM budget (65 MB for 1080p, 115 MB for 2K, 195 MB for 4K) to run reliably on low-end systems (Intel HD/Iris, integrated GPUs).
  - Uses lightweight sub-canvas edge kernel overlay and cooperative GPU buffer yielding (`setTimeout(r, 4)`).
  - Multi-pass super-resolution upscaler (Bicubic Lanczos interpolation to 1080p, 2K, or 4K Ultra HD 3840x2160).
  - Contrast-Adaptive Sharpening (CAS / unsharp masking) to extract high-frequency detail from low-res webcam sensors without halos.
  - Interactive Before/After split comparison and direct timeline track insertion.

---

## 🧼 5. AI Watermark Remover & PatchMatch Texture Synthesis Engine
- **Modal Component**: [WatermarkRemoverModal.tsx](file:///d:/Video-Editor/src/components/WatermarkRemoverModal.tsx)
- **Core Canvas Engine**: [objectRemoval.ts](file:///d:/Video-Editor/src/utils/objectRemoval.ts)
- **WebGPU Acceleration**: [WebGPUObjectRemoval.ts](file:///d:/Video-Editor/src/utils/webgpu/WebGPUObjectRemoval.ts)
- **Preset Library**: [watermarkPresets.ts](file:///d:/Video-Editor/src/utils/watermarkPresets.ts)
- **Mathematical Infilling Formulation**:
  - The PRIMARY algorithm is **PatchMatch Nearest-Neighbor Field (NNF) Texture Synthesis** sampled from clean surrounding areas. Coons boundary interpolation is kept ONLY as a reference/fallback for watermark mask detection:
    $$S_u = 3u^2 - 2u^3, \quad S_v = 3v^2 - 2v^3$$
    $$C(u, v) = (1 - S_v) T(u) + S_v B(u) + (1 - S_u) L(v) + S_u R(v) - \text{Corners}(S_u, S_v)$$
  - **PatchMatch Pipeline Steps**:
    - **Step 1: Coons BG field**: Transfinite bilinear boundary field used solely as reference for luminance/color comparison (reference only, NOT for final reconstruction).
    - **Step 2: Watermark pixel segmentation**: Multi-profile color distance and luminance contrast detection (unchanged).
    - **Step 3: 1px mask dilation for anti-aliased fringes**: Dilates mask boundary for anti-aliased fringes and compression edge ringing (unchanged).
    - **Step 4: PatchMatch NNF**: Builds source and target masks, collects candidate patches from clean surrounding regions, runs 4 PatchMatch iterations (alternating forward/backward propagation + exponential random search), with adaptive `PATCH_SIZE` ($\approx 3\text{--}7\text{px}$).
    - **Step 5: Overlapping patch voting**: Gathers patch predictions across overlapping windows with distance-weighted and spatial-proximity blending.
    - **Step 5b: Poisson gradient-domain color calibration**: 4 Gauss-Seidel relaxation passes solving Laplacian boundary constraints to seamlessly harmonize synthesized patches with scene exposure.
    - **Step 6: Edge-aware bilateral diffusion**: 4 passes propagating clean inter-letter pixels with color similarity weights.
    - **Step 7: Final compositing with reverse alpha unblending**: Blends unblended watermark pixels and PatchMatch synthesized texture with coherent grain and cubic Hermite feathering.
  - **Zero Discontinuity**: $C^1$ tangency into surrounding video pixels along all 4 perimeter borders.
  - **Adaptive Film Grain Matching**: Samples border luminance variance $\sigma^2$ and synthesizes high-frequency coherent sensor noise so the patch never looks smudgy or plastic.
  - **Poisson Clone Stamp (`patch_replace`)**: Calculates boundary luminance/chrominance delta $\Delta RGB = \mu_{\text{target}} - \mu_{\text{source}}$ to color-calibrate clone sources against local scene exposure.
  - **Selective Watermark Pixel Segmentation & Famous Brand Color Database**:
    - Defined in `FAMOUS_WATERMARK_COLOR_PROFILES` inside [watermarkPresets.ts](file:///d:/Video-Editor/src/utils/watermarkPresets.ts): Semi-Transparent White (`#FFFFFF`, `#E8E8E8`, `#D4D4D8`), TikTok/Douyin (`#FFFFFF`, `#25F4EE`, `#EE1D51`, `#FE2C55`), KineMaster (`#FFFFFF`, `#E72229`), Wondershare Filmora (`#FFFFFF`, `#28D7C8`, `#FF5500`), Shutterstock/Stock (`#FFFFFF`, `#CCCCCC`, `#E31B23`), Bandicam (`#FFFFFF`, `#1A1A1A`), CapCut/InShot/Canva (`#FFFFFF`, `#FF6600`, `#00C4CC`), and Dark Logos (`#000000`–`#2C2C2C`).
    - `scanWatermarkColorInBox` scans the user's marked region to automatically detect the watermark's exact Hex color, estimated opacity ($\hat{\alpha}$), and matching brand profile.
  - **Mathematical Reverse Alpha Unblending & Local Clean-Pixel Telea Diffusion**:
    - Instead of replacing 100% of the bounding box (which destroys the 70%+ of clean video pixels between watermark letters), the engine segments only the watermark-colored pixels (`wmMask > 0`) and leaves non-watermark pixels at `outAlpha = 0` (100% sharp, untouched original video).
    - Confirmed clean pixels *inside* the box diffuse across the 2–5px letter strokes over 6 spatial relaxation passes (`localBG`).
    - Semi-transparent watermark pixels ($\hat{\alpha} \in [0.05, 0.86]$) are unblended using the inverse alpha compositing equation (inspired by open-source tools `allenk/GeminiWatermarkTool`, `allenk/VeoWatermarkRemover`, and Dekel et al. CVPR *"On the Effectiveness of Visible Watermarks"*):
      $$I_{\text{unblended}} = \frac{I_{\text{observed}} - \hat{\alpha} \cdot C_{\text{watermark}}}{1 - \hat{\alpha}}$$
  - **Clean Compositing**: Strictly eliminates all `destination-out` calls, using pure cubic Hermite alpha masks with `source-over` compositing so video frames are never hole-punched.
  - **WebGPU Compliance**: Matches top-down canvas coordinates, float uniform unpacking, and enforces 256-byte `bytesPerRow` row pitch alignment for universal multi-aspect-ratio (16:9, 9:16 vertical reels) GPU execution.
