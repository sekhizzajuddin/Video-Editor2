# Node Description Batch 3 of 16

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

- "utils_projectpersistence_resolvemediaitemfromdb": "resolveMediaItemFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L495 | neighbors=[editorStore.ts, projectPersistence.ts, generateFrameStrip(), generateVideoThumbnail(), getFileFromDB()]
- "utils_speedramp_getmediatimeforclip": "getMediaTimeForClip()" | kind=code-symbol | source=utils/speedRamp.ts:L133 | neighbors=[PreviewCanvas.tsx, useMediaPlayback.ts, editorStore.ts, speedRamp.ts, getMediaTimeAtPosition()]
- "utils_waveformrenderer": "waveformRenderer.ts" | kind=code-symbol | source=utils/waveformRenderer.ts:L1 | neighbors=[createWaveformCanvas(), renderWaveform(), renderWaveformToDataUrl(), roundRect(), WaveformRenderOptions]
- "components_previewcanvas_spawnparticle": "spawnParticle()" | kind=code-symbol | source=components/PreviewCanvas.tsx:L287 | neighbors=[PreviewCanvas.tsx, renderParticles(), hexToRgb(), randomHue()]
- "components_timeline_gettrackheight": "getTrackHeight()" | kind=code-symbol | source=components/Timeline.tsx:L570 | neighbors=[Timeline.tsx, getTrackAtY(), getTrackTop(), Timeline()]
- "components_timeline_timeline": "Timeline()" | kind=code-symbol | source=components/Timeline.tsx:L1192 | neighbors=[App.tsx, Timeline.tsx, getTrackHeight(), getTrackTop()]
- "hooks_usemediaplayback_initaudiograph": "initAudioGraph()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L964 | neighbors=[useMediaPlayback.ts, createSeparationGraph(), getMasterAudioCtx(), getOrCreateTrackAnalyser()]
- "types_index_editortool": "EditorTool" | kind=code-symbol | source=types/index.ts:L433 | neighbors=[App.tsx, TopToolbar.tsx, editorStore.ts, index.ts]
- "ui_badge": "badge.tsx" | kind=code-symbol | source=components/ui/badge.tsx:L1 | neighbors=[utils.ts, cn(), Badge(), badgeVariants]
- "ui_kbd": "kbd.tsx" | kind=code-symbol | source=components/ui/kbd.tsx:L1 | neighbors=[utils.ts, cn(), Kbd(), KbdGroup()]
- "ui_radio_group": "radio-group.tsx" | kind=code-symbol | source=components/ui/radio-group.tsx:L1 | neighbors=[utils.ts, cn(), RadioGroup(), RadioGroupItem()]
- "ui_scroll_area": "scroll-area.tsx" | kind=code-symbol | source=components/ui/scroll-area.tsx:L1 | neighbors=[utils.ts, cn(), ScrollArea(), ScrollBar()]
- "ui_skeleton": "skeleton.tsx" | kind=code-symbol | source=components/ui/skeleton.tsx:L1 | neighbors=[sidebar.tsx, utils.ts, cn(), Skeleton()]
- "ui_textarea": "textarea.tsx" | kind=code-symbol | source=components/ui/textarea.tsx:L1 | neighbors=[input-group.tsx, utils.ts, cn(), Textarea()]
- "utils_audiosearchclient": "audioSearchClient.ts" | kind=code-symbol | source=utils/audioSearchClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, PropertiesPanel.tsx, AudioOption, searchFreesound()]
- "utils_beatdetection": "beatDetection.ts" | kind=code-symbol | source=utils/beatDetection.ts:L1 | neighbors=[MediaPanel.tsx, BeatDetectionResult, detectBeats(), smoothArray()]
- "utils_frameextractor": "frameExtractor.ts" | kind=code-symbol | source=utils/frameExtractor.ts:L1 | neighbors=[clearFrameCache(), extractFrames(), frameCache, getCachedFrames()]
- "utils_keyframes_getanimatedvalue": "getAnimatedValue()" | kind=code-symbol | source=utils/keyframes.ts:L11 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts, keyframes.ts]
- "utils_mediaprobe_extractwaveformfromurl": "extractWaveformFromUrl()" | kind=code-symbol | source=utils/mediaProbe.ts:L109 | neighbors=[mediaProbe.ts, blobUrlToArrayBuffer(), probeAudio(), probeVideo()]
- "utils_mediaprobe_probevideo": "probeVideo()" | kind=code-symbol | source=utils/mediaProbe.ts:L49 | neighbors=[mediaProbe.ts, probeFile(), captureVideoFrame(), extractWaveformFromUrl()]
- "utils_motiontracker_trackmotion": "trackMotion()" | kind=code-symbol | source=utils/motionTracker.ts:L100 | neighbors=[PropertiesPanel.tsx, motionTracker.ts, getGrayscalePatch(), matchTemplate()]
- "utils_projectpersistence_loadprojectfromdb": "loadProjectFromDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L216 | neighbors=[editorStore.ts, projectPersistence.ts, getDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_savefiletodb": "saveFileToDB()" | kind=code-symbol | source=utils/projectPersistence.ts:L49 | neighbors=[MediaPanel.tsx, editorStore.ts, projectPersistence.ts, getDB()]
- "utils_storyboardcompiler": "storyboardCompiler.ts" | kind=code-symbol | source=utils/storyboardCompiler.ts:L1 | neighbors=[PropertiesPanel.tsx, compileGridForSegment(), compileStoryboard(), StoryboardChunk]
- "components_timeline_generatefallbackwaveform": "generateFallbackWaveform()" | kind=code-symbol | source=components/Timeline.tsx:L671 | neighbors=[Timeline.tsx, seededRandom(), WaveformOverlay()]
- "components_timeline_gettracktop": "getTrackTop()" | kind=code-symbol | source=components/Timeline.tsx:L588 | neighbors=[Timeline.tsx, getTrackHeight(), Timeline()]
- "components_timeline_seededrandom": "seededRandom()" | kind=code-symbol | source=components/Timeline.tsx:L658 | neighbors=[Timeline.tsx, FrameStripOverlay(), generateFallbackWaveform()]
- "hooks_usemediaplayback_connectaudionode": "connectAudioNode()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L920 | neighbors=[useMediaPlayback.ts, getMasterAudioCtx(), getOrCreateTrackAnalyser()]
- "hooks_usemediaplayback_getmasteraudioctx": "getMasterAudioCtx()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L30 | neighbors=[useMediaPlayback.ts, connectAudioNode(), initAudioGraph()]
- "hooks_usemediaplayback_getorcreatetrackanalyser": "getOrCreateTrackAnalyser()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L898 | neighbors=[useMediaPlayback.ts, connectAudioNode(), initAudioGraph()]
- "hooks_usemediaplayback_usemediaplayback": "useMediaPlayback()" | kind=code-symbol | source=hooks/useMediaPlayback.ts:L118 | neighbors=[PreviewCanvas.tsx, PropertiesPanel.tsx, useMediaPlayback.ts]
- "types_index_clipaudiosettings": "ClipAudioSettings" | kind=code-symbol | source=types/index.ts:L96 | neighbors=[PropertiesPanel.tsx, index.ts, audioSeparation.ts]
- "types_index_cliptextsettings": "ClipTextSettings" | kind=code-symbol | source=types/index.ts:L141 | neighbors=[editorStore.ts, index.ts, titleTemplates.ts]
- "types_index_cornerpoints": "CornerPoints" | kind=code-symbol | source=types/index.ts:L41 | neighbors=[PropertiesPanel.tsx, index.ts, motionTracker.ts]
- "types_index_editorstate": "EditorState" | kind=code-symbol | source=types/index.ts:L336 | neighbors=[Timeline.tsx, editorStore.ts, index.ts]
- "types_index_mediatab": "MediaTab" | kind=code-symbol | source=types/index.ts:L436 | neighbors=[MediaPanel.tsx, editorStore.ts, index.ts]
- "types_index_mediatype": "MediaType" | kind=code-symbol | source=types/index.ts:L2 | neighbors=[MediaPanel.tsx, index.ts, mediaProbe.ts]
- "types_index_overlayerclip": "OverLayerClip" | kind=code-symbol | source=types/index.ts:L285 | neighbors=[Timeline.tsx, editorStore.ts, index.ts]
- "types_index_propertiestab": "PropertiesTab" | kind=code-symbol | source=types/index.ts:L439 | neighbors=[PropertiesPanel.tsx, editorStore.ts, index.ts]
- "types_index_timelineclip": "TimelineClip" | kind=code-symbol | source=types/index.ts:L246 | neighbors=[Timeline.tsx, editorStore.ts, index.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-002.json

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
