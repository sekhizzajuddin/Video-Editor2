# Node Description Batch 38 of 128

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

- "utils_keyboardshortcuts_default_shortcuts": "DEFAULT_SHORTCUTS" | kind=code-symbol | source=src/utils/keyboardShortcuts.ts:L10 | neighbors=[SettingsModal.tsx, App.tsx, keyboardShortcuts.ts]
- "utils_keyboardshortcuts_getshortcutstring": "getShortcutString()" | kind=code-symbol | source=src/utils/keyboardShortcuts.ts:L82 | neighbors=[SettingsModal.tsx, App.tsx, keyboardShortcuts.ts]
- "utils_keyframes_addorupdatekeyframe": "addOrUpdateKeyframe()" | kind=code-symbol | source=src/utils/keyframes.ts:L58 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, keyframes.ts]
- "utils_mediaprobe_probeaudio": "probeAudio()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L144 | neighbors=[mediaProbe.ts, extractWaveformFromUrl(), probeFile()]
- "utils_projectpersistence_clearprojectdb": "clearProjectDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L547 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_deleteautosavefromdb": "deleteAutosaveFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L420 | neighbors=[SettingsModal.tsx, projectPersistence.ts, getDB()]
- "utils_projectpersistence_deletefilefromdb": "deleteFileFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L153 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_deleteprojectmeta": "deleteProjectMeta()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L77 | neighbors=[WelcomeScreen.tsx, projectPersistence.ts, getGlobalDB()]
- "utils_projectpersistence_generateframestrip": "generateFrameStrip()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L488 | neighbors=[projectPersistence.ts, resolveMediaItemFromDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_generatevideothumbnail": "generateVideoThumbnail()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L434 | neighbors=[projectPersistence.ts, resolveMediaItemFromDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_getautosavesfromdb": "getAutosavesFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L396 | neighbors=[SettingsModal.tsx, projectPersistence.ts, getDB()]
- "utils_projectpersistence_gettemplatesfromdb": "getTemplatesFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L592 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_listrecentprojects": "listRecentProjects()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L55 | neighbors=[WelcomeScreen.tsx, projectPersistence.ts, getGlobalDB()]
- "utils_projectpersistence_saveautosavetodb": "saveAutosaveToDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L335 | neighbors=[App.tsx, projectPersistence.ts, getDB()]
- "utils_projectpersistence_saveprojecttodb": "saveProjectToDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L182 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_savetemplatestodb": "saveTemplatesToDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L561 | neighbors=[editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_setactiveproject": "setActiveProject()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L17 | neighbors=[WelcomeScreen.tsx, editorStore.ts, projectPersistence.ts]
- "utils_speedramp_getintegraltable": "getIntegralTable()" | kind=code-symbol | source=src/utils/speedRamp.ts:L76 | neighbors=[speedRamp.ts, getSpeedAtPosition(), getMediaTimeAtPosition()]
- "utils_srtparser": "srtParser.ts" | kind=code-symbol | source=src/utils/srtParser.ts:L1 | neighbors=[MediaPanel.tsx, ParsedSubtitle, parseSRT()]
- "utils_storyboardcompiler_compilestoryboard": "compileStoryboard()" | kind=code-symbol | source=src/utils/storyboardCompiler.ts:L89 | neighbors=[PropertiesPanel.tsx, storyboardCompiler.ts, compileGridForSegment()]
- "utils_time_formatsimpletime": "formatSimpleTime()" | kind=code-symbol | source=src/utils/time.ts:L14 | neighbors=[ExportModal.tsx, Timeline.tsx, time.ts]
- "utils_waveformrenderer_createwaveformcanvas": "createWaveformCanvas()" | kind=code-symbol | source=src/utils/waveformRenderer.ts:L103 | neighbors=[waveformRenderer.ts, renderWaveform(), renderWaveformToDataUrl()]
- "utils_waveformrenderer_renderwaveform": "renderWaveform()" | kind=code-symbol | source=src/utils/waveformRenderer.ts:L23 | neighbors=[waveformRenderer.ts, createWaveformCanvas(), roundRect()]
- "video_adjustment_layer_engine_generateid": "generateId()" | kind=code-symbol | source=packages/core/src/video/adjustment-layer-engine.ts:L60 | neighbors=[adjustment-layer-engine.ts, .createAdjustmentLayer(), .duplicateLayer()]
- "video_animation_engine_animationengine_cubicbezier": ".cubicBezier()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L145 | neighbors=[AnimationEngine, .applyEasing(), .createBezierFunction()]
- "video_animation_engine_animationengine_getvalueattime": ".getValueAtTime()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L24 | neighbors=[AnimationEngine, .applyEasing(), .interpolateValue()]
- "video_animation_engine_animationengine_interpolate": ".interpolate()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L87 | neighbors=[AnimationEngine, .applyEasing(), .interpolateValue()]
- "video_animation_engine_animationengine_interpolatevalue": ".interpolateValue()" | kind=code-symbol | source=packages/core/src/video/animation-engine.ts:L238 | neighbors=[AnimationEngine, .getValueAtTime(), .interpolate()]
- "video_canvas2d_fallback_renderer_canvas2dfallbackrenderer_renderlayertocanvas": ".renderLayerToCanvas()" | kind=code-symbol | source=packages/core/src/video/canvas2d-fallback-renderer.ts:L60 | neighbors=[Canvas2DFallbackRenderer, .endFrame(), .roundRect()]
- "video_chroma_key_engine_chromakeyengine_applyandcomposite": ".applyAndComposite()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L373 | neighbors=[ChromaKeyEngine, .applyChromaKey(), .composite()]
- "video_chroma_key_engine_chromakeyengine_applychromakey": ".applyChromaKey()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L159 | neighbors=[ChromaKeyEngine, .applyAndComposite(), .applyChromaKeyWithSettings()]
- "video_chroma_key_engine_chromakeyengine_calculatealpha": ".calculateAlpha()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L291 | neighbors=[ChromaKeyEngine, .applyChromaKeyWithSettings(), .getMatte()]
- "video_chroma_key_engine_chromakeyengine_colordistance": ".colorDistance()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L279 | neighbors=[ChromaKeyEngine, .applyChromaKeyWithSettings(), .getMatte()]
- "video_chroma_key_engine_chromakeyengine_composite": ".composite()" | kind=code-symbol | source=packages/core/src/video/chroma-key-engine.ts:L358 | neighbors=[ChromaKeyEngine, .applyAndComposite(), .resizeTo()]
- "video_color_grading_engine_colorgradingengine_applycurves": ".applyCurves()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L478 | neighbors=[ColorGradingEngine, .buildCurveLUT(), .ensureInitialized()]
- "video_color_grading_engine_colorgradingengine_applyhsl": ".applyHSL()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L661 | neighbors=[ColorGradingEngine, .hslToRgb(), .rgbToHsl()]
- "video_color_grading_engine_colorgradingengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/color-grading-engine.ts:L298 | neighbors=[ColorGradingEngine, .ensureInitialized(), .compileShader()]
- "video_composite_engine_compositeengine_blendlayerpixels": ".blendLayerPixels()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L122 | neighbors=[CompositeEngine, .applyBlendMode(), .compositeLayer()]
- "video_composite_engine_compositeengine_compositelayer": ".compositeLayer()" | kind=code-symbol | source=packages/core/src/video/composite-engine.ts:L107 | neighbors=[CompositeEngine, .blendLayerPixels(), .compositeLayers()]
- "video_decode_worker_createdecodeworkerurl": "createDecodeWorkerUrl()" | kind=code-symbol | source=packages/core/src/video/decode-worker.ts:L378 | neighbors=[decode-worker.ts, createDecodeWorkerBlob(), parallel-frame-decoder.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-037.json

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
