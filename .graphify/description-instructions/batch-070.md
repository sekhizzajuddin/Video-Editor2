# Node Description Batch 71 of 128

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

- "utils_audiosearchclient_searchfreesound": "searchFreesound()" | kind=code-symbol | source=src/utils/audioSearchClient.ts:L15 | neighbors=[PropertiesPanel.tsx, audioSearchClient.ts]
- "utils_audioseparation_createfallbackseparationnode": "createFallbackSeparationNode()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L132 | neighbors=[audioSeparation.ts, createSeparationNode()]
- "utils_audioseparation_updateseparationparam": "updateSeparationParam()" | kind=code-symbol | source=src/utils/audioSeparation.ts:L115 | neighbors=[audioSeparation.ts, createSeparationNode()]
- "utils_autocaptions_generateautocaptions": "generateAutoCaptions()" | kind=code-symbol | source=src/utils/autoCaptions.ts:L14 | neighbors=[autoCaptions.ts, uuidv4()]
- "utils_autocaptions_uuidv4": "uuidv4()" | kind=code-symbol | source=src/utils/autoCaptions.ts:L1 | neighbors=[autoCaptions.ts, generateAutoCaptions()]
- "utils_autocolor_calculateautocolor": "calculateAutoColor()" | kind=code-symbol | source=src/utils/autoColor.ts:L3 | neighbors=[PropertiesPanel.tsx, autoColor.ts]
- "utils_autocut": "autoCut.ts" | kind=code-symbol | source=src/utils/autoCut.ts:L1 | neighbors=[analyzeClipForAutoCuts(), AutoCutSegment]
- "utils_beatdetection_getdecodecontext": "getDecodeContext()" | kind=code-symbol | source=src/utils/beatDetection.ts:L24 | neighbors=[beatDetection.ts, detectBeats()]
- "utils_beatdetection_smootharray": "smoothArray()" | kind=code-symbol | source=src/utils/beatDetection.ts:L112 | neighbors=[beatDetection.ts, detectBeats()]
- "utils_canvaseffects_applychromakeyondata": "applyChromaKeyOnData()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L610 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_applycolorgradingwheelsondata": "applyColorGradingWheelsOnData()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L702 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_applycoloroverlays": "applyColorOverlays()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L539 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_applylumakeyondata": "applyLumaKeyOnData()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L656 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_drawmediaplaceholder": "drawMediaPlaceholder()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L512 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_drawperspectivetexture": "drawPerspectiveTexture()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L141 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_getcachedimage": "getCachedImage()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L25 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_getprojectedcorners": "getProjectedCorners()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L71 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_hextorgb": "hexToRgb()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L244 | neighbors=[canvasEffects.ts, spawnParticle()]
- "utils_canvaseffects_localcornerpoints": "LocalCornerPoints" | kind=code-symbol | source=src/utils/canvasEffects.ts:L64 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_particlepool": "ParticlePool" | kind=code-symbol | source=src/utils/canvasEffects.ts:L239 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts]
- "utils_canvaseffects_randomhue": "randomHue()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L253 | neighbors=[canvasEffects.ts, spawnParticle()]
- "utils_immutable_updates_addeffecttoclip": "addEffectToClip()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L183 | neighbors=[immutable-updates.ts, updateClipInTimeline()]
- "utils_immutable_updates_addkeyframetoclip": "addKeyframeToClip()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L219 | neighbors=[immutable-updates.ts, updateClipInTimeline()]
- "utils_immutable_updates_addtransitiontotrack": "addTransitionToTrack()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L253 | neighbors=[immutable-updates.ts, updateTrackInTimeline()]
- "utils_immutable_updates_mutableclip": "MutableClip" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L24 | neighbors=[action-executor.ts, immutable-updates.ts]
- "utils_immutable_updates_mutabletimeline": "MutableTimeline" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L22 | neighbors=[action-executor.ts, immutable-updates.ts]
- "utils_immutable_updates_mutabletrack": "MutableTrack" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L23 | neighbors=[action-executor.ts, immutable-updates.ts]
- "utils_immutable_updates_removeclipfromtimeline": "removeClipFromTimeline()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L153 | neighbors=[immutable-updates.ts, moveClipToTrack()]
- "utils_immutable_updates_removeeffectfromclip": "removeEffectFromClip()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L194 | neighbors=[immutable-updates.ts, updateClipInTimeline()]
- "utils_immutable_updates_removekeyframefromclip": "removeKeyframeFromClip()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L242 | neighbors=[immutable-updates.ts, updateClipInTimeline()]
- "utils_immutable_updates_removetransitionfromtrack": "removeTransitionFromTrack()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L264 | neighbors=[immutable-updates.ts, updateTrackInTimeline()]
- "utils_immutable_updates_updateclipproperty": "updateClipProperty()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L115 | neighbors=[immutable-updates.ts, updateClipInTimeline()]
- "utils_immutable_updates_updateeffectinclip": "updateEffectInClip()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L205 | neighbors=[immutable-updates.ts, updateClipInTimeline()]
- "utils_immutable_updates_updatetrackproperty": "updateTrackProperty()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L57 | neighbors=[immutable-updates.ts, updateTrackInTimeline()]
- "utils_keyboardshortcuts_shortcut_profiles": "SHORTCUT_PROFILES" | kind=code-symbol | source=src/utils/keyboardShortcuts.ts:L59 | neighbors=[SettingsModal.tsx, keyboardShortcuts.ts]
- "utils_lutparser_applyluttopixel": "applyLutToPixel()" | kind=code-symbol | source=src/utils/lutParser.ts:L82 | neighbors=[lutParser.ts, applyLutToCanvas()]
- "utils_lutparser_parsecubelut": "parseCubeLut()" | kind=code-symbol | source=src/utils/lutParser.ts:L16 | neighbors=[MediaPanel.tsx, lutParser.ts]
- "utils_mediaprobe_bloburltoarraybuffer": "blobUrlToArrayBuffer()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L15 | neighbors=[mediaProbe.ts, extractWaveformFromUrl()]
- "utils_mediaprobe_capturevideoframe": "captureVideoFrame()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L25 | neighbors=[mediaProbe.ts, probeVideo()]
- "utils_mediaprobe_detectmediatype": "detectMediaType()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L218 | neighbors=[mediaProbe.ts, probeFile()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-070.json

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
