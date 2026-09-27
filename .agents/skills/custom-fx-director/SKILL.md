---
name: custom-fx-director
description: >-
  Multimodal AI Custom FX Maker that scans video clips simultaneously with
  Groq Whisper (audio) and Gemini Vision (visual), then co-reasons with
  Groq GPT-OSS 120B + Gemini Flash to generate scene-justified HTML/CSS/SVG
  animation overlays. Use when the user says "custom fx", "create custom effect",
  "AI fx maker", "generate overlay animation", or wants to create a
  dialogue-driven motion graphic overlay for a specific video clip.
---

# Custom FX Director — Multimodal AI Animation Overlay Generator

Generates scene-justified animation overlays by simultaneously analyzing a video clip's audio (Groq Whisper) and visual composition (Gemini Vision), then synthesizing both into browser-compatible HTML/CSS/SVG animations that overlay the video.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  CustomFxMakerModal (UI)                        │
│  clip selection → scanning → agent insights → preview → save   │
└───────────────┬─────────────────────────────────────────────────┘
                │ calls
                ▼
┌─────────────────────────────────────────────────────────────────┐
│          customFxDirector.ts — orchestrator                     │
│  1. extractClipAudioToWav() + transcribeWithGroqWhisper()       │
│  2. compileStoryboard() + Gemini Vision analysis                │
│  3. Co-reasoning: Groq GPT-OSS 120B + Gemini Flash              │
│  4. sanitizeMotionSceneHtml() + validateSceneQuality()          │
│  5. Auto-retry with correction prompt if rejected               │
│  6. createSceneStage() for live preview                         │
│  7. Generate thumbnail at t=50%                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| [`customFxDirector.ts`](file:///d:/Video-Editor/src/utils/customFxDirector.ts) | Core engine: parallel scanning, co-reasoning, validation, thumbnail |
| [`CustomFxMakerModal.tsx`](file:///d:/Video-Editor/src/components/CustomFxMakerModal.tsx) | Modal UI: agent insights, prompt editor, live preview |
| [`cssSceneRasterizer.ts`](file:///d:/Video-Editor/src/utils/cssSceneRasterizer.ts) | Frame-accurate CSS→canvas rasterization for preview + export |
| [`generateMotionGraphicsFromDialogue.ts`](file:///d:/Video-Editor/src/utils/generateMotionGraphicsFromDialogue.ts) | Existing motion graphics pipeline (reused patterns) |
| [`aiSpeedSync.ts`](file:///d:/Video-Editor/src/utils/aiSpeedSync.ts) | Audio extraction + Groq Whisper transcription (reused) |
| [`storyboardCompiler.ts`](file:///d:/Video-Editor/src/utils/storyboardCompiler.ts) | Video frame capture (reused) |
| [`editorStore.ts`](file:///d:/Video-Editor/src/store/editorStore.ts) | Zustand store: customFxList, addCustomFx, removeCustomFx |

---

## Scene Genre Classification

The co-reasoning agent classifies the clip into one of these genres to guide animation style:

| Genre | Animation Direction |
|-------|--------------------|
| **Explainer** | Isometric 3D city assets, data callouts, animated charts, leader lines |
| **Tech / Metrics** | HUD panels, radar arcs, streaming tickers, monospace labels, neon strokes |
| **Action** | Impact flashes, speed lines, targeting brackets, shake effects |
| **Interview / Talking Head** | Lower-third name badges, pull-quote callouts, subtle particle effects |
| **Cinematic** | Letterbox bars, film grain overlay, slow Ken Burns parallax |
| **Comedy / Reaction** | Comic burst shapes, emoji reactions, bouncy text, confetti |
| **Tutorial / How-to** | Step numbered badges, progress indicators, highlight circles, pointer arrows |
| **Vlog / Lifestyle** | Minimal Swiss typography, thin rules, elegant easing, one accent color |

---

## Spatial Safe Zone Rules

The Visual Agent detects subject positions and reports safe zones for overlay placement:

| Subject Position | Safe Zone | Overlay Placement |
|-----------------|-----------|-------------------|
| Left third | Right 60% | Right-side data panels, callouts, badges |
| Right third | Left 60% | Left-side annotations, leader lines |
| Center speaker | Upper 20% + lower 20% | Lower-third bar or corner badges |
| Full-body wide shot | Frame perimeter | HUD frame around subject, corner stats |
| Close-up face | Avoid eyes/mouth zone | Corner badges, bottom strip, flanking elements |
| No dominant subject | Full frame available | Full-frame compositions (charts, maps, diagrams) |

---

## Animation Format Constraints

All generated animations MUST follow these rules:

1. **Root wrapper**: `<div style="position:relative;width:1920px;height:1080px;overflow:hidden;background:transparent">`
2. **SVG artwork**: Inside `<svg width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;top:0;left:0;overflow:visible;">`
3. **CSS animations**: `@keyframes` with `animation-fill-mode: both` and staggered `animation-delay`
4. **NO external resources**: No `<img src="http..."`, no `<link>`, no `@import`, no web fonts. Only web-safe fonts.
5. **NO scripts/iframes**: No `<script>`, no `<iframe>`, no event handlers
6. **Transparent background**: The overlay composites on top of the video
7. **Minimum 8 SVG shape elements**: Prevents text-only designs
8. **Text budget ≤ 25%**: Text must not dominate; artwork is primary
9. **Duration sync**: All animation durations and delays must fit within the clip duration

---

## Co-Reasoning Prompt Template

The co-reasoning agent receives:

```
You are an elite Motion Graphics Director creating a video overlay animation.

AUDIO ANALYSIS:
- Transcript: "..."
- Keywords: [...]
- Tone: energetic | calm | dramatic
- Pace: fast | moderate | slow

VISUAL ANALYSIS:
- Scene Type: explainer | action | interview | ...
- Subjects: "..."
- Safe Zones: "right-third" | "lower-third" | ...
- Color Palette: ["#...", "#..."]
- Composition: "..."

DURATION: X.Xs

CREATE a self-contained HTML/CSS/SVG animation overlay that:
1. Visually JUSTIFIES the spoken dialogue through artwork (not just animated text)
2. Respects the safe zones (don't obscure the subject)
3. Matches the emotional tone and pacing
4. Uses CSS @keyframes with animation-fill-mode: both
5. Has transparent background
6. Contains 8+ SVG shape elements

Return JSON: {
  "name": "Descriptive Effect Name",
  "reasoning": "Why this animation matches this scene",
  "htmlCss": "<div style=\"...\">"
}
```

---

## Validation & Auto-Retry

The generated animation is validated using the existing `validateSceneQuality()` function.
If rejected (< 8 SVG shapes, text-only), a correction prompt is sent:

```
Your previous design was REJECTED: it contained only N SVG shapes (minimum 8).
Rewrite from scratch with REAL vector artwork...
```

The better of the two attempts is used.

---

## API Model Priorities

### Audio Agent (Groq Whisper)
1. `whisper-large-v3-turbo` (preferred)
2. `whisper-large-v3` (fallback)

### Visual Agent (Gemini Vision)
1. `gemini-3.5-flash-lite` (fast, good quality)
2. `gemini-3.8-flash` (higher quality fallback)
3. `gemini-2.5-flash` (safety fallback)

### Co-Reasoning Agent (Groq + Gemini)
1. `openai/gpt-oss-120b` via Groq (preferred reasoning model)
2. `llama-3.3-70b-versatile` via Groq (fallback)
3. Gemini Flash cascade (`gemini-3.5-flash-lite` -> `gemini-3.8-flash` -> `gemini-2.5-flash`)

---

## Scan Caching & Deep-Thinking Re-generation

To prevent redundant API calls and deliver deeper reasoning on iteration:
1. **In-Memory Scan Cache**: Clip audio transcripts (Whisper) and scene keyframe breakdowns (Gemini Vision) are cached in `_clipScanCache` keyed by clip ID, media ID, and trim bounds.
2. **Instant Re-generation**: Clicking "Regenerate" bypasses audio and vision extraction completely, skipping straight to the Co-Reasoning phase with zero re-scan delay.
3. **Deep Thinking Directives**: On re-generation passes, the temperature is elevated to `0.65` and the AI is instructed to diverge creatively from prior designs, exploring more complex SVG geometries, multi-stage CSS keyframes, and deeper thematic metaphors.
4. **Enforced Transparency**: All generated HTML passes through `enforceHtmlTransparency()` which forces `background: transparent !important;` on the root container and neutralizes any full-screen opaque rectangles or divs.

