# Node Description Batch 89 of 128

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the prompt below and write
your JSON answer to the answer file.

## Prompt

You are documenting nodes in a knowledge graph.
For each entry below, write ONE concise factual plain-language sentence
describing what it is or does. Use only the provided context.
For a code symbol (kind=code-symbol — a function, class, or constant),
describe what the function/symbol does based on its name, source location
and neighbors — e.g. "Resolves the configured ontology profile from graphify.yaml.".
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "graphics_graphics_engine_graphicsengine_updatekeyframe": ".updateKeyframe()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1669 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_updateshapeclip": ".updateShapeClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L263 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_updatestickerclip": ".updateStickerClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1933 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_updatesvgclip": ".updateSVGClip()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1795 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_graphicsengine_updatetransform": ".updateTransform()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L303 | neighbors=[GraphicsEngine]
- "graphics_graphics_engine_test_mockcanvas_getcontext": ".getContext()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.test.ts:L51 | neighbors=[MockCanvas]
- "graphics_graphics_engine_test_mockcanvascontext": "MockCanvasContext" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.test.ts:L6 | neighbors=[graphics-engine.test.ts]
- "graphics_sticker_library_emoji_categories": "EMOJI_CATEGORIES" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L16 | neighbors=[sticker-library.ts]
- "graphics_sticker_library_emojicategory": "EmojiCategory" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L10 | neighbors=[sticker-library.ts]
- "graphics_sticker_library_stickercategory": "StickerCategory" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L4 | neighbors=[sticker-library.ts]
- "graphics_sticker_library_stickerlibrary_addcategory": ".addCategory()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L248 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_clearcustomstickers": ".clearCustomStickers()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L379 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_createstickerclip": ".createStickerClip()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L284 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getallstickers": ".getAllStickers()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L229 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getcategories": ".getCategories()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L252 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getcategory": ".getCategory()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L256 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getemojicategories": ".getEmojiCategories()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L260 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getemojisbycategory": ".getEmojisByCategory()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L264 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getsticker": ".getSticker()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L225 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_getstickersbycategory": ".getStickersByCategory()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L233 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_removesticker": ".removeSticker()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L221 | neighbors=[StickerLibrary]
- "graphics_sticker_library_stickerlibrary_searchstickers": ".searchStickers()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L239 | neighbors=[StickerLibrary]
- "graphics_svg_animation_presets_svg_animation_presets": "SVG_ANIMATION_PRESETS" | kind=code-symbol | source=packages/core/src/graphics/svg-animation-presets.ts:L12 | neighbors=[svg-animation-presets.ts]
- "graphics_svg_animation_presets_svganimationpresetinfo": "SVGAnimationPresetInfo" | kind=code-symbol | source=packages/core/src/graphics/svg-animation-presets.ts:L3 | neighbors=[svg-animation-presets.ts]
- "graphics_types_default_emphasis_animation": "DEFAULT_EMPHASIS_ANIMATION" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L115 | neighbors=[types.ts]
- "graphics_types_default_graphic_animation": "DEFAULT_GRAPHIC_ANIMATION" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L128 | neighbors=[types.ts]
- "graphics_types_default_svg_color_style": "DEFAULT_SVG_COLOR_STYLE" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L122 | neighbors=[types.ts]
- "graphics_types_emphasisanimationtype": "EmphasisAnimationType" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L75 | neighbors=[types.ts]
- "graphics_types_gradientstop": "GradientStop" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L192 | neighbors=[types.ts]
- "graphics_types_graphictype": "GraphicType" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L21 | neighbors=[types.ts]
- "graphics_types_material3dstyle": "Material3DStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L173 | neighbors=[types.ts]
- "graphics_types_preserveaspectratio": "PreserveAspectRatio" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L221 | neighbors=[types.ts]
- "graphics_types_shadowstyle": "ShadowStyle" | kind=code-symbol | source=packages/core/src/graphics/types.ts:L207 | neighbors=[types.ts]
- "hooks_usemediaplayback_cubicinterp": "cubicInterp()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L945 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_disconnectaudionode": "disconnectAudioNode()" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L1004 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_mediaelement": "MediaElement" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L78 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_mediaplaybackresult": "MediaPlaybackResult" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L114 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_separationgraph": "SeparationGraph" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L1282 | neighbors=[useMediaPlayback.ts]
- "hooks_usemediaplayback_trackanalysers": "trackAnalysers" | kind=code-symbol | source=src/hooks/useMediaPlayback.ts:L23 | neighbors=[useMediaPlayback.ts]
- "media_audio_match_engine_audiomatchengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/media/audio-match-engine.ts:L7 | neighbors=[AudioMatchEngine]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-088.json

Keep each description factual and concise (one sentence). No markdown, no prose
outside the JSON object. It is acceptable to omit a node if context is
insufficient — but include every node you can ground confidently.

Example answer format:
```json
{
  "node_id_1": "Resolves the configured ontology profile from graphify.yaml.",
  "node_id_2": "Colonel James Barclay, an antagonist in The Crooked Man."
}
```
