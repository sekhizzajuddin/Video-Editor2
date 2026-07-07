# Node Description Batch 117 of 128

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

- "video_chroma_key_engine_chromakeyengine_setsettings": ".setSettings()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L155 | neighbors=[ChromaKeyEngine]
- "video_chroma_key_engine_chromakeyengineconfig": "ChromaKeyEngineConfig" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L27 | neighbors=[chroma-key-engine.ts]
- "video_chroma_key_engine_chromakeymatte": "ChromaKeyMatte" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L21 | neighbors=[chroma-key-engine.ts]
- "video_chroma_key_engine_chromakeyresult": "ChromaKeyResult" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L15 | neighbors=[chroma-key-engine.ts]
- "video_chroma_key_engine_chromakeysettings": "ChromaKeySettings" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L7 | neighbors=[chroma-key-engine.ts]
- "video_chroma_key_engine_default_chroma_key_settings": "DEFAULT_CHROMA_KEY_SETTINGS" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L33 | neighbors=[chroma-key-engine.ts]
- "video_chroma_key_engine_rgb": "RGB" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L1 | neighbors=[chroma-key-engine.ts]
- "video_color_grading_engine_colorgradingengine_applylut": ".applyLUT()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L568 | neighbors=[ColorGradingEngine]
- "video_color_grading_engine_colorgradingengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L293 | neighbors=[ColorGradingEngine]
- "video_color_grading_engine_colorgradingengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L903 | neighbors=[ColorGradingEngine]
- "video_color_grading_engine_colorgradingengine_generatehistogram": ".generateHistogram()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L781 | neighbors=[ColorGradingEngine]
- "video_color_grading_engine_colorgradingengine_generatevectorscope": ".generateVectorscope()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L747 | neighbors=[ColorGradingEngine]
- "video_color_grading_engine_colorgradingengine_generatewaveform": ".generateWaveform()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L707 | neighbors=[ColorGradingEngine]
- "video_color_grading_engine_colorgradingresult": "ColorGradingResult" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L52 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_colorwheelvalues": "ColorWheelValues" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L3 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_curvesvalues": "CurvesValues" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L12 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_default_color_wheels": "DEFAULT_COLOR_WHEELS" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L57 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_default_curves": "DEFAULT_CURVES" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L66 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_default_hsl": "DEFAULT_HSL" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L85 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_histogramdata": "HistogramData" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L45 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_hslvalues": "HSLValues" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L19 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_lutdata": "LUTData" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L25 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_shaderprogram": "ShaderProgram" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L276 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_vectorscopedata": "VectorscopeData" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L40 | neighbors=[color-grading-engine.ts]
- "video_color_grading_engine_waveformscopedata": "WaveformScopeData" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L31 | neighbors=[color-grading-engine.ts]
- "video_composite_engine_chroma_key_presets": "CHROMA_KEY_PRESETS" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L39 | neighbors=[composite-engine.ts]
- "video_composite_engine_chromakeyconfig": "ChromaKeyConfig" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L9 | neighbors=[composite-engine.ts]
- "video_composite_engine_compositechromakeyresult": "CompositeChromaKeyResult" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L29 | neighbors=[composite-engine.ts]
- "video_composite_engine_compositeengine_constructor": ".constructor()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L62 | neighbors=[CompositeEngine]
- "video_composite_engine_compositeengine_getdimensions": ".getDimensions()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L431 | neighbors=[CompositeEngine]
- "video_composite_engine_compositeengine_resize": ".resize()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L422 | neighbors=[CompositeEngine]
- "video_composite_engine_compositeengine_samplekeycolor": ".sampleKeyColor()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L378 | neighbors=[CompositeEngine]
- "video_composite_engine_compositeengineconfig": "CompositeEngineConfig" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L34 | neighbors=[composite-engine.ts]
- "video_composite_engine_compositelayerinput": "CompositeLayerInput" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L16 | neighbors=[composite-engine.ts]
- "video_composite_engine_compositeresult": "CompositeResult" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L23 | neighbors=[composite-engine.ts]
- "video_composite_engine_getavailableblendmodes": "getAvailableBlendModes()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L436 | neighbors=[composite-engine.ts]
- "video_composite_engine_getblendmodename": "getBlendModeName()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L453 | neighbors=[composite-engine.ts]
- "video_composite_engine_rgbcolor": "RGBColor" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L3 | neighbors=[composite-engine.ts]
- "video_decode_worker_cachedresource": "CachedResource" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L33 | neighbors=[decode-worker.ts]
- "video_decode_worker_clearcache": "clearCache()" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L174 | neighbors=[decode-worker.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-116.json

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
