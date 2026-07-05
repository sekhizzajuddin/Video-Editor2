# Node Description Batch 7 of 16

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

- "utils_aiclient_aicueresult": "AICueResult" | kind=code-symbol | source=utils/aiClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, aiClient.ts]
- "utils_aiclient_analyzestoryboardwithgemini": "analyzeStoryboardWithGemini()" | kind=code-symbol | source=utils/aiClient.ts:L12 | neighbors=[PropertiesPanel.tsx, aiClient.ts]
- "utils_aiclient_refineaudioquerywithgroq": "refineAudioQueryWithGroq()" | kind=code-symbol | source=utils/aiClient.ts:L116 | neighbors=[PropertiesPanel.tsx, aiClient.ts]
- "utils_audiosearchclient_audiooption": "AudioOption" | kind=code-symbol | source=utils/audioSearchClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, audioSearchClient.ts]
- "utils_audiosearchclient_searchfreesound": "searchFreesound()" | kind=code-symbol | source=utils/audioSearchClient.ts:L15 | neighbors=[PropertiesPanel.tsx, audioSearchClient.ts]
- "utils_audioseparation_createfallbackseparationnode": "createFallbackSeparationNode()" | kind=code-symbol | source=utils/audioSeparation.ts:L132 | neighbors=[audioSeparation.ts, createSeparationNode()]
- "utils_audioseparation_updateseparationparam": "updateSeparationParam()" | kind=code-symbol | source=utils/audioSeparation.ts:L115 | neighbors=[audioSeparation.ts, createSeparationNode()]
- "utils_beatdetection_smootharray": "smoothArray()" | kind=code-symbol | source=utils/beatDetection.ts:L99 | neighbors=[beatDetection.ts, detectBeats()]
- "utils_lutparser_applyluttopixel": "applyLutToPixel()" | kind=code-symbol | source=utils/lutParser.ts:L82 | neighbors=[lutParser.ts, applyLutToCanvas()]
- "utils_lutparser_parsecubelut": "parseCubeLut()" | kind=code-symbol | source=utils/lutParser.ts:L16 | neighbors=[MediaPanel.tsx, lutParser.ts]
- "utils_mediaprobe_bloburltoarraybuffer": "blobUrlToArrayBuffer()" | kind=code-symbol | source=utils/mediaProbe.ts:L15 | neighbors=[mediaProbe.ts, extractWaveformFromUrl()]
- "utils_mediaprobe_capturevideoframe": "captureVideoFrame()" | kind=code-symbol | source=utils/mediaProbe.ts:L25 | neighbors=[mediaProbe.ts, probeVideo()]
- "utils_mediaprobe_detectmediatype": "detectMediaType()" | kind=code-symbol | source=utils/mediaProbe.ts:L218 | neighbors=[mediaProbe.ts, probeFile()]
- "utils_mediaprobe_generateid": "generateId()" | kind=code-symbol | source=utils/mediaProbe.ts:L13 | neighbors=[mediaProbe.ts, probeFile()]
- "utils_mediaprobe_probeimage": "probeImage()" | kind=code-symbol | source=utils/mediaProbe.ts:L183 | neighbors=[mediaProbe.ts, probeFile()]
- "utils_motiontracker_getgrayscalepatch": "getGrayscalePatch()" | kind=code-symbol | source=utils/motionTracker.ts:L9 | neighbors=[motionTracker.ts, trackMotion()]
- "utils_motiontracker_matchtemplate": "matchTemplate()" | kind=code-symbol | source=utils/motionTracker.ts:L36 | neighbors=[motionTracker.ts, trackMotion()]
- "utils_speedramp_getfullkeyframes": "getFullKeyframes()" | kind=code-symbol | source=utils/speedRamp.ts:L3 | neighbors=[speedRamp.ts, getSpeedAtPosition()]
- "utils_srtparser_parsesrt": "parseSRT()" | kind=code-symbol | source=utils/srtParser.ts:L10 | neighbors=[MediaPanel.tsx, srtParser.ts]
- "utils_storyboardcompiler_compilegridforsegment": "compileGridForSegment()" | kind=code-symbol | source=utils/storyboardCompiler.ts:L11 | neighbors=[storyboardCompiler.ts, compileStoryboard()]
- "utils_time_formattime": "formatTime()" | kind=code-symbol | source=utils/time.ts:L1 | neighbors=[PreviewCanvas.tsx, time.ts]
- "utils_titletemplates_template_categories": "TEMPLATE_CATEGORIES" | kind=code-symbol | source=utils/titleTemplates.ts:L292 | neighbors=[MediaPanel.tsx, titleTemplates.ts]
- "utils_titletemplates_templatecategory": "TemplateCategory" | kind=code-symbol | source=utils/titleTemplates.ts:L300 | neighbors=[MediaPanel.tsx, titleTemplates.ts]
- "utils_waveformrenderer_renderwaveformtodataurl": "renderWaveformToDataUrl()" | kind=code-symbol | source=utils/waveformRenderer.ts:L121 | neighbors=[waveformRenderer.ts, createWaveformCanvas()]
- "utils_waveformrenderer_roundrect": "roundRect()" | kind=code-symbol | source=utils/waveformRenderer.ts:L79 | neighbors=[waveformRenderer.ts, renderWaveform()]
- "app_app": "App()" | kind=code-symbol | source=App.tsx:L17 | neighbors=[App.tsx]
- "components_aisounddesigner_aicueresult": "AICueResult" | kind=code-symbol | neighbors=[CueWithOptions]
- "components_aisounddesigner_aisounddesignerprops": "AiSoundDesignerProps" | kind=code-symbol | source=components/AiSoundDesigner.tsx:L11 | neighbors=[AiSoundDesigner.tsx]
- "components_audiomixer_channelstrip": "ChannelStrip()" | kind=code-symbol | source=components/AudioMixer.tsx:L76 | neighbors=[AudioMixer.tsx]
- "components_audiomixer_channelstripprops": "ChannelStripProps" | kind=code-symbol | source=components/AudioMixer.tsx:L68 | neighbors=[AudioMixer.tsx]
- "components_audiomixer_masterchannelstrip": "MasterChannelStrip()" | kind=code-symbol | source=components/AudioMixer.tsx:L319 | neighbors=[AudioMixer.tsx]
- "components_audiomixer_masterchannelstripprops": "MasterChannelStripProps" | kind=code-symbol | source=components/AudioMixer.tsx:L312 | neighbors=[AudioMixer.tsx]
- "components_exportmodal_ensureffmpegloaded": "ensureFFmpegLoaded()" | kind=code-symbol | source=components/ExportModal.tsx:L14 | neighbors=[ExportModal.tsx]
- "components_exportmodal_exportstatus": "ExportStatus" | kind=code-symbol | source=components/ExportModal.tsx:L47 | neighbors=[ExportModal.tsx]
- "components_exportmodal_ffmpeg": "ffmpeg" | kind=code-symbol | source=components/ExportModal.tsx:L8 | neighbors=[ExportModal.tsx]
- "components_exportmodal_ffmpeglogs": "ffmpegLogs" | kind=code-symbol | source=components/ExportModal.tsx:L12 | neighbors=[ExportModal.tsx]
- "components_mediapanel_color_correction_effects": "COLOR_CORRECTION_EFFECTS" | kind=code-symbol | source=components/MediaPanel.tsx:L91 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_fx_effects": "FX_EFFECTS" | kind=code-symbol | source=components/MediaPanel.tsx:L73 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_particle_effects": "PARTICLE_EFFECTS" | kind=code-symbol | source=components/MediaPanel.tsx:L103 | neighbors=[MediaPanel.tsx]
- "components_mediapanel_text_templates": "TEXT_TEMPLATES" | kind=code-symbol | source=components/MediaPanel.tsx:L166 | neighbors=[MediaPanel.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\src\.graphify\description-instructions\batch-006.json

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
