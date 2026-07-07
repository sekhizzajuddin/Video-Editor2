# Node Description Batch 48 of 128

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

- "beat_detection_index_beatdetectionprocessor_computermsenergies": ".computeRMSEnergies()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L201 | neighbors=[BeatDetectionProcessor, jsComputeRMSEnergies()]
- "beat_detection_index_beatdetectionprocessor_findpeaks": ".findPeaks()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L233 | neighbors=[BeatDetectionProcessor, jsFindPeaks()]
- "beat_detection_index_beatdetectionprocessor_smootharray": ".smoothArray()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L214 | neighbors=[BeatDetectionProcessor, jsSmoothArray()]
- "beat_detection_index_iswasmbeatdetectionavailable": "isWasmBeatDetectionAvailable()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L70 | neighbors=[index.ts, index.ts]
- "beat_detection_index_jscalculatemean": "jsCalculateMean()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L161 | neighbors=[index.ts, .calculateMean()]
- "beat_detection_index_jscalculatemedian": "jsCalculateMedian()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L120 | neighbors=[index.ts, .calculateMedian()]
- "beat_detection_index_jscalculatestddev": "jsCalculateStdDev()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L171 | neighbors=[index.ts, .calculateStdDev()]
- "beat_detection_index_jscomputermsenergies": "jsComputeRMSEnergies()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L74 | neighbors=[index.ts, .computeRMSEnergies()]
- "beat_detection_index_jsfindpeaks": "jsFindPeaks()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L132 | neighbors=[index.ts, .findPeaks()]
- "beat_detection_index_jssmootharray": "jsSmoothArray()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L97 | neighbors=[index.ts, .smoothArray()]
- "beat_detection_index_loadwasmmodule": "loadWasmModule()" | kind=code-symbol | source=packages/core/src/wasm/beat-detection/index.ts:L30 | neighbors=[index.ts, initWasmBeatDetection()]
- "components_aimotiongraphicsdesigner_aimotiongraphicsdesigner": "AiMotionGraphicsDesigner()" | kind=code-symbol | source=src/components/AiMotionGraphicsDesigner.tsx:L13 | neighbors=[AiMotionGraphicsDesigner.tsx, PropertiesPanel.tsx]
- "components_aisounddesigner_aisounddesigner": "AiSoundDesigner()" | kind=code-symbol | source=src/components/AiSoundDesigner.tsx:L17 | neighbors=[AiSoundDesigner.tsx, PropertiesPanel.tsx]
- "components_aisounddesigner_cuewithoptions": "CueWithOptions" | kind=code-symbol | source=src/components/AiSoundDesigner.tsx:L7 | neighbors=[AiSoundDesigner.tsx, AICueResult]
- "components_audiomixer_audiomixer": "AudioMixer()" | kind=code-symbol | source=src/components/AudioMixer.tsx:L6 | neighbors=[AudioMixer.tsx, App.tsx]
- "components_colorscopes_colorscopes": "ColorScopes()" | kind=code-symbol | source=src/components/ColorScopes.tsx:L9 | neighbors=[ColorScopes.tsx, PreviewCanvas.tsx]
- "components_exportmodal_exportmodal": "ExportModal()" | kind=code-symbol | source=src/components/ExportModal.tsx:L49 | neighbors=[ExportModal.tsx, App.tsx]
- "components_helpmodal_helpmodal": "HelpModal()" | kind=code-symbol | source=src/components/HelpModal.tsx:L110 | neighbors=[HelpModal.tsx, App.tsx]
- "components_helptooltipmanager_helptooltipmanager": "HelpTooltipManager()" | kind=code-symbol | source=src/components/HelpTooltipManager.tsx:L5 | neighbors=[HelpTooltipManager.tsx, App.tsx]
- "components_mediapanel_mediapanel": "MediaPanel()" | kind=code-symbol | source=src/components/MediaPanel.tsx:L171 | neighbors=[MediaPanel.tsx, App.tsx]
- "components_previewcanvas_previewcanvas": "PreviewCanvas()" | kind=code-symbol | source=src/components/PreviewCanvas.tsx:L49 | neighbors=[PreviewCanvas.tsx, App.tsx]
- "components_propertiespanel_propertiespanel": "PropertiesPanel()" | kind=code-symbol | source=src/components/PropertiesPanel.tsx:L242 | neighbors=[PropertiesPanel.tsx, App.tsx]
- "components_settingsmodal_settingsmodal": "SettingsModal()" | kind=code-symbol | source=src/components/SettingsModal.tsx:L9 | neighbors=[SettingsModal.tsx, App.tsx]
- "components_telepromptermodal_telepromptermodal": "TeleprompterModal()" | kind=code-symbol | source=src/components/TeleprompterModal.tsx:L9 | neighbors=[TeleprompterModal.tsx, App.tsx]
- "components_thumbnailmodal_thumbnailmodal": "ThumbnailModal()" | kind=code-symbol | source=src/components/ThumbnailModal.tsx:L19 | neighbors=[PreviewCanvas.tsx, ThumbnailModal.tsx]
- "components_timeline_floatingscrubtooltip": "FloatingScrubTooltip()" | kind=code-symbol | source=src/components/Timeline.tsx:L1142 | neighbors=[Timeline.tsx, formatDetailedTooltipTime()]
- "components_timeline_formatdetailedtooltiptime": "formatDetailedTooltipTime()" | kind=code-symbol | source=src/components/Timeline.tsx:L653 | neighbors=[Timeline.tsx, FloatingScrubTooltip()]
- "components_timeline_framestripoverlay": "FrameStripOverlay()" | kind=code-symbol | source=src/components/Timeline.tsx:L726 | neighbors=[Timeline.tsx, seededRandom()]
- "components_timeline_gettrackaty": "getTrackAtY()" | kind=code-symbol | source=src/components/Timeline.tsx:L615 | neighbors=[Timeline.tsx, getTrackHeight()]
- "components_timeline_waveformoverlay": "WaveformOverlay()" | kind=code-symbol | source=src/components/Timeline.tsx:L785 | neighbors=[Timeline.tsx, generateFallbackWaveform()]
- "components_toptoolbar_toptoolbar": "TopToolbar()" | kind=code-symbol | source=src/components/TopToolbar.tsx:L67 | neighbors=[TopToolbar.tsx, App.tsx]
- "components_transcriptpanel_transcriptpanel": "TranscriptPanel()" | kind=code-symbol | source=src/components/TranscriptPanel.tsx:L6 | neighbors=[MediaPanel.tsx, TranscriptPanel.tsx]
- "components_welcomescreen_welcomescreen": "WelcomeScreen()" | kind=code-symbol | source=src/components/WelcomeScreen.tsx:L5 | neighbors=[WelcomeScreen.tsx, App.tsx]
- "device_device_capabilities_calculateoveralltier": "calculateOverallTier()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L226 | neighbors=[device-capabilities.ts, detectDeviceCapabilities()]
- "device_device_capabilities_checkcodecsupport": "checkCodecSupport()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L166 | neighbors=[device-capabilities.ts, detectEncodingSupport()]
- "device_device_capabilities_clearbenchmarkcache": "clearBenchmarkCache()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L409 | neighbors=[device-capabilities.ts, index.ts]
- "device_device_capabilities_codecrecommendation": "CodecRecommendation" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L54 | neighbors=[device-capabilities.ts, index.ts]
- "device_device_capabilities_cpuinfo": "CpuInfo" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L3 | neighbors=[device-capabilities.ts, index.ts]
- "device_device_capabilities_detectplatform": "detectPlatform()" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L106 | neighbors=[device-capabilities.ts, detectDeviceCapabilities()]
- "device_device_capabilities_devicecodecsupport": "DeviceCodecSupport" | kind=code-symbol | source=packages/core/src/device/device-capabilities.ts:L20 | neighbors=[device-capabilities.ts, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-047.json

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
