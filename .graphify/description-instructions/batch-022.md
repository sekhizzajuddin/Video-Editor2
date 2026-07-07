# Node Description Batch 23 of 128

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

- "types_actions_keyframeaction": "KeyframeAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L149 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_mediaaction": "MediaAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L75 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_projectaction": "ProjectAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L66 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_subtitleaction": "SubtitleAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L208 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_timelineaction": "TimelineAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L225 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_trackaction": "TrackAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L81 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_transformaction": "TransformAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L143 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_actions_transitionaction": "TransitionAction" | kind=code-symbol | source=packages/core/src/types/actions.ts:L175 | neighbors=[action-executor.ts, action-validator.ts, inverse-action-generator.ts, actions.ts]
- "types_composition_easingfunction": "EasingFunction" | kind=code-symbol | source=packages/core/src/types/composition.ts:L99 | neighbors=[composition-renderer.ts, composition.ts, transform-3d.ts, transitions.ts]
- "types_composition_vector3d": "Vector3D" | kind=code-symbol | source=packages/core/src/types/composition.ts:L24 | neighbors=[composition.ts, Vector2D, index.ts, transform-3d.ts]
- "types_effects_audioeffectparams": "AudioEffectParams" | kind=code-symbol | source=packages/core/src/types/effects.ts:L704 | neighbors=[audio-effect-routing.ts, audio-effects-engine.ts, audio-engine.ts, effects.ts]
- "types_effects_transitiontype": "TransitionType" | kind=code-symbol | source=packages/core/src/types/effects.ts:L606 | neighbors=[actions.ts, effects.ts, timeline.ts, transition-engine.ts]
- "types_index_editortool": "EditorTool" | kind=code-symbol | source=src/types/index.ts:L513 | neighbors=[TopToolbar.tsx, App.tsx, editorStore.ts, index.ts]
- "types_index_transition": "Transition" | kind=code-symbol | source=src/types/index.ts:L525 | neighbors=[action-executor.ts, editorStore.ts, generators.ts, index.ts]
- "types_project_projectsettings": "ProjectSettings" | kind=code-symbol | source=packages/core/src/types/project.ts:L5 | neighbors=[actions.ts, project.ts, scriptable-template.ts, template.ts]
- "ui_badge": "badge.tsx" | kind=code-symbol | source=src/components/ui/badge.tsx:L1 | neighbors=[utils.ts, cn(), Badge(), badgeVariants]
- "ui_kbd": "kbd.tsx" | kind=code-symbol | source=src/components/ui/kbd.tsx:L1 | neighbors=[utils.ts, cn(), Kbd(), KbdGroup()]
- "ui_radio_group": "radio-group.tsx" | kind=code-symbol | source=src/components/ui/radio-group.tsx:L1 | neighbors=[utils.ts, cn(), RadioGroup(), RadioGroupItem()]
- "ui_scroll_area": "scroll-area.tsx" | kind=code-symbol | source=src/components/ui/scroll-area.tsx:L1 | neighbors=[utils.ts, cn(), ScrollArea(), ScrollBar()]
- "ui_skeleton": "skeleton.tsx" | kind=code-symbol | source=src/components/ui/skeleton.tsx:L1 | neighbors=[sidebar.tsx, utils.ts, cn(), Skeleton()]
- "ui_textarea": "textarea.tsx" | kind=code-symbol | source=src/components/ui/textarea.tsx:L1 | neighbors=[input-group.tsx, utils.ts, cn(), Textarea()]
- "upscaling_upscaling_engine_upscalingengine_applyedgedetection": ".applyEdgeDetection()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L428 | neighbors=[UpscalingEngine, .getPooledTexture(), .upscaleBalanced(), .upscaleQuality()]
- "upscaling_upscaling_engine_upscalingengine_applyedgedirected": ".applyEdgeDirected()" | kind=code-symbol | source=packages/core/src/video/upscaling/upscaling-engine.ts:L477 | neighbors=[UpscalingEngine, .getPooledTexture(), .upscaleBalanced(), .upscaleQuality()]
- "utils_aibackground_applyaibackgroundmask": "applyAiBackgroundMask()" | kind=code-symbol | source=src/utils/aiBackground.ts:L108 | neighbors=[PreviewCanvas.tsx, aiBackground.ts, segmentFrame(), canvasEffects.ts]
- "utils_aiclient_test": "aiClient.test.ts" | kind=code-symbol | source=src/utils/aiClient.test.ts:L1 | neighbors=[aiClient.ts, analyzeMotionGraphicsWithGemini(), analyzeStoryboardWithGemini(), refineAudioQueryWithGroq()]
- "utils_audiosearchclient": "audioSearchClient.ts" | kind=code-symbol | source=src/utils/audioSearchClient.ts:L1 | neighbors=[AiSoundDesigner.tsx, PropertiesPanel.tsx, AudioOption, searchFreesound()]
- "utils_autocolor": "autoColor.ts" | kind=code-symbol | source=src/utils/autoColor.ts:L1 | neighbors=[PropertiesPanel.tsx, index.ts, ClipColorFilters, calculateAutoColor()]
- "utils_beatdetection_detectbeats": "detectBeats()" | kind=code-symbol | source=src/utils/beatDetection.ts:L35 | neighbors=[MediaPanel.tsx, beatDetection.ts, getDecodeContext(), smoothArray()]
- "utils_canvaseffects_spawnparticle": "spawnParticle()" | kind=code-symbol | source=src/utils/canvasEffects.ts:L258 | neighbors=[canvasEffects.ts, renderParticles(), hexToRgb(), randomHue()]
- "utils_frameextractor": "frameExtractor.ts" | kind=code-symbol | source=src/utils/frameExtractor.ts:L1 | neighbors=[clearFrameCache(), extractFrames(), frameCache, getCachedFrames()]
- "utils_immutable_updates_addcliptotrack": "addClipToTrack()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L135 | neighbors=[immutable-updates.ts, updateTrackInTimeline(), duplicateClip(), moveClipToTrack()]
- "utils_immutable_updates_movecliptotrack": "moveClipToTrack()" | kind=code-symbol | source=packages/core/src/utils/immutable-updates.ts:L331 | neighbors=[immutable-updates.ts, addClipToTrack(), findClipById(), removeClipFromTimeline()]
- "utils_lutparser_applyluttocanvas": "applyLutToCanvas()" | kind=code-symbol | source=src/utils/lutParser.ts:L152 | neighbors=[PreviewCanvas.tsx, canvasEffects.ts, lutParser.ts, applyLutToPixel()]
- "utils_mediaprobe_extractwaveformfromurl": "extractWaveformFromUrl()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L109 | neighbors=[mediaProbe.ts, blobUrlToArrayBuffer(), probeAudio(), probeVideo()]
- "utils_mediaprobe_probevideo": "probeVideo()" | kind=code-symbol | source=src/utils/mediaProbe.ts:L49 | neighbors=[mediaProbe.ts, probeFile(), captureVideoFrame(), extractWaveformFromUrl()]
- "utils_motiontracker_trackmotion": "trackMotion()" | kind=code-symbol | source=src/utils/motionTracker.ts:L100 | neighbors=[PropertiesPanel.tsx, motionTracker.ts, getGrayscalePatch(), matchTemplate()]
- "utils_projectpersistence_getglobaldb": "getGlobalDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L37 | neighbors=[projectPersistence.ts, deleteProjectMeta(), listRecentProjects(), saveProjectMeta()]
- "utils_projectpersistence_loadprojectfromdb": "loadProjectFromDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L293 | neighbors=[editorStore.ts, projectPersistence.ts, getDB(), restoreSnapshotMedia()]
- "utils_projectpersistence_savefiletodb": "saveFileToDB()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L125 | neighbors=[MediaPanel.tsx, editorStore.ts, projectPersistence.ts, getDB()]
- "utils_projectpersistence_saveprojectmeta": "saveProjectMeta()" | kind=code-symbol | source=src/utils/projectPersistence.ts:L66 | neighbors=[WelcomeScreen.tsx, editorStore.ts, projectPersistence.ts, getGlobalDB()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-022.json

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
