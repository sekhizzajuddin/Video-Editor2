# Graph Report - .  (2026-07-07)

## Corpus Check
- 328 files · ~4,37,579 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5114 nodes · 8948 edges · 219 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 2631 · method: 2145 · calls: 2008 · imports: 1039 · imports_from: 654 · re_exports: 380 · inherits: 69 · implements: 22


## Input Scope
- Requested: auto
- Resolved: all (source: default-auto)
- Included files: 328 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed
## God Nodes (most connected - your core abstractions)
1. `VideoEngine` - 69 edges
2. `GraphicsEngine` - 63 edges
3. `cn()` - 51 edges
4. `WebGPURenderer` - 49 edges
5. `PlaybackController` - 46 edges
6. `VideoEffectsEngine` - 46 edges
7. `wt` - 42 edges
8. `MaskEngine` - 40 edges
9. `ls` - 39 edges
10. `RealtimeAudioGraph` - 38 edges

## Surprising Connections (you probably didn't know these)
- `initializeAutoReframeEngine()` --calls--> `AutoReframeEngine`  [EXTRACTED]
  packages/core/src/ai/auto-reframe-engine.ts → packages/core/src/ai/auto-reframe-engine.ts  _Bridges community 129 → community 120_
- `initializeBackgroundRemovalEngine()` --calls--> `BackgroundRemovalEngine`  [EXTRACTED]
  packages/core/src/ai/background-removal-engine.ts → packages/core/src/ai/background-removal-engine.ts  _Bridges community 177 → community 130_
- `LottieLayer` --inherits--> `BaseLayer`  [EXTRACTED]
  packages/core/src/animation/animation-schema.ts → packages/core/src/animation/animation-schema.ts  _Bridges community 23 → community 80_
- `getAudioEngine()` --calls--> `AudioEngine`  [EXTRACTED]
  packages/core/src/audio/audio-engine.ts → packages/core/src/audio/audio-engine.ts  _Bridges community 74 → community 28_
- `getBeatDetectionEngine()` --calls--> `BeatDetectionEngine`  [EXTRACTED]
  packages/core/src/audio/beat-detection-engine.ts → packages/core/src/audio/beat-detection-engine.ts  _Bridges community 103 → community 121_

## Communities

### Community 79 - "Community 79"
Cohesion: 0.22
Nodes (20): Action, ActionResult, ActionErrorCode, ActionError, ValidationResult, ValidationError, ProjectAction, MediaAction (+12 more)

### Community 84 - "Community 84"
Cohesion: 0.17
Nodes (1): ActionExecutor

### Community 152 - "Community 152"
Cohesion: 0.19
Nodes (7): HistoryEntry, ActionGroup, HistorySnapshot, ACTION_DESCRIPTIONS, AUTO_GROUPABLE_TYPES, TARGET_PARAM_KEYS, ActionSerializer

### Community 53 - "Community 53"
Cohesion: 0.10
Nodes (3): getActionDescription(), getActionTargetId(), ActionHistory

### Community 140 - "Community 140"
Cohesion: 0.35
Nodes (1): ActionValidator

### Community 117 - "Community 117"
Cohesion: 0.30
Nodes (1): InverseActionGenerator

### Community 129 - "Community 129"
Cohesion: 0.13
Nodes (13): AspectRatioPreset, PlatformPreset, AspectRatioConfig, ASPECT_RATIO_PRESETS, PLATFORM_PRESETS, DetectedFace, ReframeKeyframe, ReframeSettings (+5 more)

### Community 120 - "Community 120"
Cohesion: 0.19
Nodes (1): AutoReframeEngine

### Community 177 - "Community 177"
Cohesion: 0.20
Nodes (7): BackgroundMode, BackgroundRemovalSettings, DEFAULT_BACKGROUND_SETTINGS, ProgressCallback, getBackgroundRemovalEngine(), initializeBackgroundRemovalEngine(), disposeBackgroundRemovalEngine()

### Community 130 - "Community 130"
Cohesion: 0.22
Nodes (1): BackgroundRemovalEngine

### Community 159 - "Community 159"
Cohesion: 0.23
Nodes (4): SegmentationResult, PersonSegmentationEngine, getPersonSegmentationEngine(), disposePersonSegmentationEngine()

### Community 80 - "Community 80"
Cohesion: 0.13
Nodes (23): ExportResult, ExportOptions, GroupedKeyframes, ImportResult, ImportOptions, importAnimation(), importAnimationFromJSON(), AnimationSchema (+15 more)

### Community 160 - "Community 160"
Cohesion: 0.33
Nodes (3): AnimationExporter, exportAnimation(), exportAnimationToJSON()

### Community 161 - "Community 161"
Cohesion: 0.32
Nodes (4): createDefaultMediaMetadata(), parseFontWeight(), mapShapeType(), AnimationImporter

### Community 23 - "Community 23"
Cohesion: 0.09
Nodes (40): ProjectConfig, FontAsset, ImageAsset, VideoAsset, AudioAsset, LottieAsset, LayerType, Position (+32 more)

### Community 49 - "Community 49"
Cohesion: 0.10
Nodes (29): BlendMode, Vector2D, Vector3D, Transform, FillStyle, StrokeStyle, TextStyle, TextAnimation (+21 more)

### Community 82 - "Community 82"
Cohesion: 0.15
Nodes (1): CompositionRenderer

### Community 141 - "Community 141"
Cohesion: 0.15
Nodes (13): EasingName, CubicBezierEasing, SpringEasing, EasingFunction, EasingFn, EASING_FUNCTIONS, cubicBezier(), getEasingFunction() (+5 more)

### Community 55 - "Community 55"
Cohesion: 0.09
Nodes (15): GSAPMotionPathPoint, MotionPathConfig, GSAPAnimationConfig, GSAP_EASING_MAP, easingToGSAP(), sampleMotionPath(), cubicBezierInterpolate(), catmullRomInterpolate() (+7 more)

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (22): SerializedNoiseProfile, isFiniteNumberArray(), isValidFftSize(), isSerializedNoiseProfile(), getPreviewAudioEffects(), getPanFromAudioEffects(), splitProfileAwareNoiseReductionEffects(), MediaBunnyAudioInput (+14 more)

### Community 38 - "Community 38"
Cohesion: 0.10
Nodes (5): toSpectralNoiseProfile(), getSpectralSmoothingForFocus(), AudioEffectsEngine, getAudioEffectsEngine(), initializeAudioEffectsEngine()

### Community 75 - "Community 75"
Cohesion: 0.12
Nodes (25): AudioEffectChainConfig, ReverbConfig, SimpleNoiseProfile, EffectProcessingResult, EffectNodePair, NoiseReductionFocus, NoiseReductionBandSpec, NoiseReductionFocusProfile (+17 more)

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (2): SegmentedAudioDecoder, AudioEngine

### Community 103 - "Community 103"
Cohesion: 0.12
Nodes (13): BeatAnalysisResult, BeatDetectionConfig, DEFAULT_BEAT_DETECTION_CONFIG, getBeatDetectionEngine(), ClipTiming, SyncMode, BeatSyncConfig, DEFAULT_BEAT_SYNC_CONFIG (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (33): Beat, CutMode, AutoEditOptions, DEFAULT_AUTO_EDIT_OPTIONS, AutoEditCut, AutoEditResult, AutoEditService, getAutoEditService() (+25 more)

### Community 121 - "Community 121"
Cohesion: 0.18
Nodes (2): BeatDetectionEngine, disposeBeatDetectionEngine()

### Community 142 - "Community 142"
Cohesion: 0.24
Nodes (11): createClip(), createTrack(), createSeparatedAudioTimeline(), TimelineWithTracks, getClipAudioTrackIndex(), isAlignedLinkedClip(), getLinkedAudioClips(), resolveClipAudioEffects() (+3 more)

### Community 39 - "Community 39"
Cohesion: 0.08
Nodes (27): sanitizePoints(), getAutomationValueAtTime(), getVolumeAutomationPointsForRange(), scheduleVolumeAutomationOnGain(), TranscriptWord, AudioSegmentMetrics, HighlightAnalysisResult, TrackConfig (+19 more)

### Community 189 - "Community 189"
Cohesion: 0.32
Nodes (5): EffectWorkletParams, DEFAULT_EFFECT_WORKLET_PARAMS, createEffectsWorkletBlob(), createEffectsWorkletUrl(), loadEffectsWorklet()

### Community 61 - "Community 61"
Cohesion: 0.11
Nodes (14): FFT, getFFT(), NoiseReductionConfig, DEFAULT_NOISE_REDUCTION_CONFIG, detectNoiseSegments(), extractAudioSegment(), autoLearnNoiseProfile(), findQuietestContiguousWindow() (+6 more)

### Community 190 - "Community 190"
Cohesion: 0.25
Nodes (2): TestAudioBuffer, NoiseProfile

### Community 131 - "Community 131"
Cohesion: 0.22
Nodes (1): SpectralNoiseReducer

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (19): AudioClipSchedule, ClockState, ClockSubscriber, ClockOptions, MasterTimelineClock, getMasterClock(), initializeMasterClock(), disposeMasterClock() (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.09
Nodes (3): RealtimeAudioGraph, initializeRealtimeAudioGraph(), disposeRealtimeAudioGraph()

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (4): RealtimeAudioProcessor, TrackProcessor, getRealtimeAudioProcessor(), initializeRealtimeProcessor()

### Community 96 - "Community 96"
Cohesion: 0.15
Nodes (18): GeneratedSound, NOTE_FREQUENCIES, CHORD_PROGRESSIONS, RICH_PROGRESSIONS, MELODY_PATTERNS, SCALES, getSoundGenerator(), SoundCategory (+10 more)

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (1): SoundGenerator

### Community 91 - "Community 91"
Cohesion: 0.14
Nodes (2): SoundLibraryEngine, createSoundLibraryEngine()

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (3): clampVolume(), VolumeAutomation, AudioDucker

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (37): DeviceTier, CpuInfo, MemoryInfo, GpuInfo, DeviceCodecSupport, EncodingSupport, BenchmarkResult, DeviceProfile (+29 more)

### Community 122 - "Community 122"
Cohesion: 0.13
Nodes (8): full, BUILT_IN_EDITING_TEMPLATES, builtInTemplateMap, EditingTemplateCategory, EditingTemplateBinding, EditingTemplateTransform, EditingTemplateOverlay, EditingTemplate

### Community 221 - "Community 221"
Cohesion: 0.50
Nodes (2): EDITING_TEMPLATE_CATEGORIES, EditingTemplateCategoryDefinition

### Community 92 - "Community 92"
Cohesion: 0.12
Nodes (20): DEFAULT_TRANSFORM, getEditingTemplateDefaultControlValues(), resolveEditingTemplateControlValues(), resolveEditingTemplate(), resolveOverlayTiming(), resolveRangeTiming(), resolveEffect(), resolveEffectKeyframes() (+12 more)

### Community 186 - "Community 186"
Cohesion: 0.36
Nodes (9): isEditingTemplateBinding(), resolveTemplateVariables(), resolveOverlay(), resolveOverlayKeyframes(), resolveTransform(), resolveEmphasisAnimation(), resolveNestedValue(), resolveValue() (+1 more)

### Community 97 - "Community 97"
Cohesion: 0.11
Nodes (20): EditingTemplateTargetType, EditingTemplateControlType, EditingTemplateControlOption, EditingTemplateEffect, EditingTemplateIntroTiming, EditingTemplateOutroTiming, EditingTemplateRangeTiming, EditingTemplateTiming (+12 more)

### Community 205 - "Community 205"
Cohesion: 0.33
Nodes (3): BlendMode, BlendModeSettings, BlendModeEngine

### Community 123 - "Community 123"
Cohesion: 0.15
Nodes (2): ExpressionContext, ExpressionEngine

### Community 170 - "Community 170"
Cohesion: 0.33
Nodes (8): hexToRgb(), lerpColor(), Vector3, ParticleConfig, ParticleEffect, Particle, EmitterState, DEFAULT_PARTICLE_CONFIG

### Community 206 - "Community 206"
Cohesion: 0.53
Nodes (4): generateId(), randomRange(), getEmissionPosition(), getInitialVelocity()

### Community 109 - "Community 109"
Cohesion: 0.13
Nodes (3): ParticleEngine, getParticleEngine(), disposeParticleEngine()

### Community 162 - "Community 162"
Cohesion: 0.18
Nodes (10): ParticlePreset, CONFETTI_COLORS, FIRE_COLORS, SPARKLE_COLORS, DUST_COLORS, MAGIC_COLORS, PARTICLE_PRESETS, getParticlePresetById() (+2 more)

### Community 93 - "Community 93"
Cohesion: 0.11
Nodes (14): {
  mockRenderFrame,
  mockVideoEngine,
  mockRenderAudio,
  mockAudioEngine,
  mockMediaEngine,
  mockVideoSourceAdd,
  mockAudioSourceAdd,
  mockOutputStart,
  mockOutputFinalize,
}, MockMp4OutputFormat, MockWebMOutputFormat, MockMovOutputFormat, MockOutput, MockStreamTarget, MockVideoSampleSource, MockAudioBufferSource (+6 more)

### Community 85 - "Community 85"
Cohesion: 0.21
Nodes (19): getExportEngine(), initializeExportEngine(), downloadBlob(), UpscaleQuality, UpscalingSettings, DEFAULT_UPSCALING_SETTINGS, AudioExportSettings, ImageExportSettings (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.13
Nodes (1): ExportEngine

### Community 153 - "Community 153"
Cohesion: 0.18
Nodes (8): WorkerMessage, WorkerResponse, QueuedFrame, frameQueue, processFrameQueue(), processFrame(), queueFrame(), VideoExportSettings

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (41): MockCanvasContext, MockCanvas, EmphasisAnimation, AnimatedTextState, CharacterAnimationState, CreateTextClipOptions, UpdateTextClipOptions, CloudflareWhisperWord (+33 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (39): AnimatedGraphicState, StickerCategory, EmojiCategory, EMOJI_CATEGORIES, SVGAnimationPresetInfo, SVG_ANIMATION_PRESETS, getSVGPresetInfo(), createDefaultSVGAnimation() (+31 more)

### Community 57 - "Community 57"
Cohesion: 0.07
Nodes (1): GraphicsEngine

### Community 86 - "Community 86"
Cohesion: 0.11
Nodes (1): StickerLibrary

### Community 132 - "Community 132"
Cohesion: 0.14
Nodes (13): EffectCategory, EffectParamDefinition, EffectDefinition, EffectParamValue, LayerEffect, EFFECT_DEFINITIONS, getEffectDefinition(), createDefaultEffect() (+5 more)

### Community 217 - "Community 217"
Cohesion: 0.50
Nodes (1): AudioMatchEngine

### Community 104 - "Community 104"
Cohesion: 0.13
Nodes (18): FFmpegInstance, AudioStreamInfo, AudioProbeResult, AudioExtractionOptions, ProxySettings, PROXY_PRESETS, PROXY_THRESHOLDS, TranscodeOptions (+10 more)

### Community 68 - "Community 68"
Cohesion: 0.24
Nodes (1): FFmpegFallback

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (36): GifFrame, DecodedGif, GifFrameCache, decodeGif(), createGifFrameCache(), getGifFrameAtTime(), isAnimatedGif(), SUPPORTED_VIDEO_FORMATS (+28 more)

### Community 98 - "Community 98"
Cohesion: 0.15
Nodes (3): MediaImportService, getMediaImportService(), initializeMediaImportService()

### Community 45 - "Community 45"
Cohesion: 0.13
Nodes (2): ExportFrameDecoder, MediaBunnyEngine

### Community 200 - "Community 200"
Cohesion: 0.33
Nodes (2): TranscriptionWord, TranscriptionEngine

### Community 124 - "Community 124"
Cohesion: 0.17
Nodes (2): WaveformGenerator, createWaveformGenerator()

### Community 154 - "Community 154"
Cohesion: 0.24
Nodes (3): WaveformRenderer, createWaveformImage(), createClipWaveformThumbnail()

### Community 99 - "Community 99"
Cohesion: 0.14
Nodes (18): PhotoEngineConfig, getPhotoEngine(), initializePhotoEngine(), LayerType, PhotoBlendMode, PhotoLayer, LayerTransform, PhotoProject (+10 more)

### Community 111 - "Community 111"
Cohesion: 0.20
Nodes (3): AdjustmentLayerConfig, PhotoAdjustmentEngine, getPhotoAdjustmentEngine()

### Community 69 - "Community 69"
Cohesion: 0.10
Nodes (1): PhotoEngine

### Community 105 - "Community 105"
Cohesion: 0.13
Nodes (4): BrushConfig, DEFAULT_BRUSH_CONFIG, RetouchingEngine, getRetouchingEngine()

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (3): PlaybackController, getPlaybackController(), initializePlaybackController()

### Community 72 - "Community 72"
Cohesion: 0.11
Nodes (17): CacheManagerConfig, DEFAULT_CACHE_CONFIG, CacheStats, createCacheManager(), createStorageEngine(), STORES, ProjectRecord, ProjectSummary (+9 more)

### Community 147 - "Community 147"
Cohesion: 0.19
Nodes (1): CacheManager

### Community 201 - "Community 201"
Cohesion: 0.38
Nodes (5): ProjectFile, ValidationResult, ProjectFileWithMetadata, MediaRecord, IStorageEngine

### Community 135 - "Community 135"
Cohesion: 0.18
Nodes (2): ProjectSerializer, createProjectSerializer()

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (3): createStorageError(), StorageEngine, IStorageEngine

### Community 73 - "Community 73"
Cohesion: 0.10
Nodes (24): DEFAULT_TRANSFORM, BUILTIN_TEMPLATES, ProjectSettings, PlaceholderTarget, ExtendedPlaceholder, ScriptableTemplate, ScriptableTemplateReplacements, TemplateValidationError (+16 more)

### Community 76 - "Community 76"
Cohesion: 0.11
Nodes (2): TemplateEngine, createTemplateEngine()

### Community 46 - "Community 46"
Cohesion: 0.06
Nodes (27): defaultFcParams, idArb, nameArb, timestampArb, durationArb, timePositionArb, easingTypeArb, projectSettingsArb (+19 more)

### Community 136 - "Community 136"
Cohesion: 0.22
Nodes (12): WordSegmentStyle, WordSegment, AnimatedCaptionFrame, renderNone(), renderWordHighlight(), renderWordByWord(), renderKaraoke(), renderBounce() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (28): CharacterInfo, WordInfo, LineInfo, TextLayout, AnimatedCharacter, AnimatedWord, AnimatedLine, AnimatedTextLayout (+20 more)

### Community 25 - "Community 25"
Cohesion: 0.06
Nodes (22): SpeechRecognitionResult, SpeechRecognitionAlternative, SpeechRecognitionResultList, SpeechRecognitionEvent, Event, SpeechRecognitionErrorEvent, SpeechRecognitionInstance, EventTarget (+14 more)

### Community 58 - "Community 58"
Cohesion: 0.09
Nodes (11): DEFAULT_SUBTITLE_STYLE, SUBTITLE_STYLE_PRESETS, SRTParseResult, SRTParseError, generateSubtitleId(), parseSRTTimestamp(), formatSRTTimestamp(), parseSRT() (+3 more)

### Community 89 - "Community 89"
Cohesion: 0.16
Nodes (1): TextAnimationEngine

### Community 94 - "Community 94"
Cohesion: 0.15
Nodes (1): TitleEngine

### Community 150 - "Community 150"
Cohesion: 0.25
Nodes (3): TranscriptionService, initializeTranscriptionService(), disposeTranscriptionService()

### Community 64 - "Community 64"
Cohesion: 0.12
Nodes (3): createMockTrack(), createMockTimeline(), ClipManager

### Community 113 - "Community 113"
Cohesion: 0.12
Nodes (2): generateId(), NestedSequenceEngine

### Community 126 - "Community 126"
Cohesion: 0.18
Nodes (1): TrackManager

### Community 90 - "Community 90"
Cohesion: 0.09
Nodes (22): BezierPoint, BezierPath, ShapeTool, ShapeMergeOperation, TrimPathConfig, StrokeAnimationConfig, RectangleShapeConfig, EllipseShapeConfig (+14 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (14): CurvePoint, ColorWheelValues, CurvesValues, HSLValues, LUTData, WaveformScopeData, VectorscopeData, HistogramData (+6 more)

### Community 41 - "Community 41"
Cohesion: 0.09
Nodes (25): TransitionParams, Track, Clip, Transition, Mutable, updateTrackInTimeline(), updateTrackProperty(), updateClipInTimeline() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (62): LottieAnimation, LottieMeta, LottieMarker, LottieAsset, LottieImageAsset, LottiePrecompAsset, LottieLayer, BaseLottieLayer (+54 more)

### Community 151 - "Community 151"
Cohesion: 0.14
Nodes (1): Result

### Community 137 - "Community 137"
Cohesion: 0.13
Nodes (11): ExtendedPlaceholderType, PlaceholderUIHints, ExtendedPlaceholderConstraints, PlaceholderConstraints, SocialMediaCategory, SocialMediaPreset, SOCIAL_MEDIA_PRESETS, TemplateScene (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (42): Effect, AdjustmentLayer, CreateAdjustmentLayerOptions, AdjustmentLayerEffect, BLEND_MODE_INFO, DEFAULT_CONFIG, PreloadTask, GPUCompositeLayer (+34 more)

### Community 35 - "Community 35"
Cohesion: 0.07
Nodes (20): Keyframe, BezierControlPoints, InterpolationResult, AnimationEngine, EasingPreset, BezierCurve, ExtendedKeyframe, Keyframe (+12 more)

### Community 127 - "Community 127"
Cohesion: 0.12
Nodes (10): Transform3D, Camera, DepthOfFieldConfig, Layer3DConfig, AutoOrientMode, Layer3DKeyframe, DEFAULT_TRANSFORM_3D, DEFAULT_CAMERA (+2 more)

### Community 83 - "Community 83"
Cohesion: 0.12
Nodes (23): ClipTransitionType, WipeDirection, SlideDirection, IrisShape, BaseTransition, DissolveTransition, FadeTransition, WipeTransition (+15 more)

### Community 226 - "Community 226"
Cohesion: 0.50
Nodes (1): generateId()

### Community 102 - "Community 102"
Cohesion: 0.12
Nodes (3): generateId(), AdjustmentLayerEngine, getAdjustmentLayerEngine()

### Community 114 - "Community 114"
Cohesion: 0.12
Nodes (2): Canvas2DFallbackRenderer, Renderer

### Community 44 - "Community 44"
Cohesion: 0.09
Nodes (8): RGB, ChromaKeySettings, ChromaKeyResult, ChromaKeyMatte, ChromaKeyEngineConfig, DEFAULT_CHROMA_KEY_SETTINGS, createDefaultChromaKeySettings(), ChromaKeyEngine

### Community 78 - "Community 78"
Cohesion: 0.10
Nodes (8): RGBColor, ChromaKeyConfig, CompositeLayerInput, CompositeResult, CompositeChromaKeyResult, CompositeEngineConfig, CHROMA_KEY_PRESETS, CompositeEngine

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (23): DecodeRequest, DecodeResponse, InitRequest, InitResponse, WorkerRequest, WorkerResponse, CachedResource, resourceCache (+15 more)

### Community 168 - "Community 168"
Cohesion: 0.17
Nodes (7): FilterEffectType, FilterEffectParams, FilterEffect, FilterPreset, FILTER_PRESETS, FILTER_CATEGORIES, FilterCategory

### Community 118 - "Community 118"
Cohesion: 0.18
Nodes (1): FrameCache

### Community 185 - "Community 185"
Cohesion: 0.22
Nodes (1): PreloadManager

### Community 110 - "Community 110"
Cohesion: 0.24
Nodes (7): CacheEntry, disposeFrameInterpolationEngine(), OpticalFlowGPU, FlowField, InterpolationConfig, FrameInterpolationResult, INTERPOLATION_QUALITY_PRESETS

### Community 198 - "Community 198"
Cohesion: 0.33
Nodes (1): FlowFieldCache

### Community 164 - "Community 164"
Cohesion: 0.27
Nodes (2): FrameInterpolationEngine, getFrameInterpolationEngine()

### Community 192 - "Community 192"
Cohesion: 0.39
Nodes (1): OpticalFlowCPU

### Community 36 - "Community 36"
Cohesion: 0.08
Nodes (6): FrameData, FrameRingBufferStats, FrameRingBuffer, CompositeFrameBuffer, getFrameRingBuffer(), getCompositeFrameBuffer()

### Community 51 - "Community 51"
Cohesion: 0.08
Nodes (3): GPUCompositor, getGPUCompositor(), disposeGPUCompositor()

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (1): KeyframeEngine

### Community 119 - "Community 119"
Cohesion: 0.12
Nodes (15): MaskPoint, BezierPoint, BezierPath, MaskShapeType, RectangleMaskShape, EllipseMaskShape, PolygonMaskShape, MaskShape (+7 more)

### Community 203 - "Community 203"
Cohesion: 0.29
Nodes (3): generateId(), shapeToPath(), createDefaultPath()

### Community 233 - "Community 233"
Cohesion: 0.67
Nodes (2): interpolatePaths(), applyEasing()

### Community 65 - "Community 65"
Cohesion: 0.08
Nodes (1): MaskEngine

### Community 22 - "Community 22"
Cohesion: 0.06
Nodes (14): Point, Rectangle, TrackingOptions, TrackingJobStatus, TrackingJob, TrackingKeyframe, TrackingData, TrackingAttachment (+6 more)

### Community 66 - "Community 66"
Cohesion: 0.07
Nodes (6): CameraAngle, MultiCamGroup, AngleSwitch, SyncResult, ANGLE_COLORS, MultiCamEngine

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (8): PlaybackEngineState, FrameCallback, PlaybackEngineConfig, BufferedFrame, ActiveStream, PlaybackEngine, getPlaybackEngine(), initializePlaybackEngine()

### Community 88 - "Community 88"
Cohesion: 0.10
Nodes (17): LayerUniforms, TransformUniforms, BorderRadiusUniforms, createLayerUniformsBuffer(), createTransformUniformsBuffer(), createTransformMatrix(), EffectUniforms, BlurUniforms (+9 more)

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (3): SpeedEngine, getSpeedEngine(), initializeSpeedEngine()

### Community 125 - "Community 125"
Cohesion: 0.28
Nodes (13): extractDominantMotion(), findDominantMotionCluster(), accumulateMotionPath(), smoothPath(), buildGaussianKernel(), computeCorrections(), disposeStabilizationEngine(), MotionSample (+5 more)

### Community 155 - "Community 155"
Cohesion: 0.23
Nodes (3): StabilizationEngine, getStabilizedTransform(), getStabilizationEngine()

### Community 134 - "Community 134"
Cohesion: 0.16
Nodes (6): FFmpegInstance, VIDSTAB_CORE_CDN, VidstabProgress, VidstabEngine, getVidstabEngine(), disposeVidstabEngine()

### Community 115 - "Community 115"
Cohesion: 0.16
Nodes (5): CachedTexture, TextureCacheConfig, getCacheKey(), TextureCache, calculateTextureSize()

### Community 169 - "Community 169"
Cohesion: 0.17
Nodes (1): TransformAnimator

### Community 60 - "Community 60"
Cohesion: 0.13
Nodes (2): TransitionEngine, createTransitionEngine()

### Community 158 - "Community 158"
Cohesion: 0.24
Nodes (3): UnifiedEffectsProcessor, getUnifiedEffectsProcessor(), initUnifiedEffectsProcessor()

### Community 166 - "Community 166"
Cohesion: 0.24
Nodes (9): createLanczosDimensionsBuffer(), getUpscalingEngine(), UpscaleQuality, UpscalingSettings, DEFAULT_UPSCALING_SETTINGS, UpscalingConfig, TexturePoolEntry, UpscalingPipelines (+1 more)

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (1): UpscalingEngine

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (4): VideoEffectsEngine, getVideoEffectsEngineAsync(), getVideoEffectsEngine(), disposeVideoEffectsEngine()

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (3): VideoEngine, getVideoEngine(), initializeVideoEngine()

### Community 116 - "Community 116"
Cohesion: 0.17
Nodes (1): WebGPUEffectsProcessor

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (2): WebGPURenderer, Renderer

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (104): Navigator, GPU, GPURequestAdapterOptions, GPUAdapter, GPUSupportedFeatures, GPUSupportedLimits, GPUDeviceDescriptor, GPUFeatureName (+96 more)

### Community 239 - "Community 239"
Cohesion: 1.00
Nodes (2): GPUDevice, EventTarget

### Community 234 - "Community 234"
Cohesion: 0.67
Nodes (3): GPUProgrammableStage, GPUVertexState, GPUFragmentState

### Community 81 - "Community 81"
Cohesion: 0.09
Nodes (3): partition(), quickSelect(), calculateMedian()

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (15): WasmBeatDetectionExports, loadWasmModule(), initWasmBeatDetection(), isWasmBeatDetectionAvailable(), jsComputeRMSEnergies(), jsSmoothArray(), jsCalculateMedian(), jsFindPeaks() (+7 more)

### Community 163 - "Community 163"
Cohesion: 0.26
Nodes (1): WasmFFT

### Community 108 - "Community 108"
Cohesion: 0.17
Nodes (11): WasmWavExports, loadWasmModule(), initWasmWav(), isWasmWavAvailable(), jsEncodeWav16Mono(), jsEncodeWav16Stereo(), jsEncodeWav24Stereo(), jsWriteWavHeader() (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (66): LevelsChannel, LevelsAdjustment, CurvePoint, CurvesChannel, CurvesAdjustment, ColorBalanceValues, ColorBalanceAdjustment, SelectiveColorValues (+58 more)

### Community 47 - "Community 47"
Cohesion: 0.10
Nodes (24): SIZE, makeProject(), makeShapeLayer(), makeGroupSetup(), DEFAULT_SIZE, DEFAULT_BG, validateLayerTree(), serializeProject() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (17): Command, cloneProject(), SetProjectNameCommand, AddArtboardCommand, RemoveArtboardCommand, RestoreArtboardCommand, UpdateArtboardCommand, ReorderLayerCommand (+9 more)

### Community 146 - "Community 146"
Cohesion: 0.14
Nodes (3): AddLayerCommand, RemoveLayerCommand, DuplicateLayerCommand

### Community 211 - "Community 211"
Cohesion: 0.33
Nodes (1): UpdateLayerTransformCommand

### Community 210 - "Community 210"
Cohesion: 0.33
Nodes (1): UpdateLayerStyleCommand

### Community 212 - "Community 212"
Cohesion: 0.33
Nodes (1): UpdateTextCommand

### Community 209 - "Community 209"
Cohesion: 0.33
Nodes (1): ApplyAdjustmentCommand

### Community 182 - "Community 182"
Cohesion: 0.22
Nodes (2): PasteLayersCommand, RemovePastedLayersCommand

### Community 187 - "Community 187"
Cohesion: 0.22
Nodes (3): MaskType, LayerMask, DEFAULT_LAYER_MASK

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (26): migrateProject(), migrateV0ToV1(), CreateProjectDocumentOptions, DuplicateLayerResult, DeserializeProjectResult, DeserializeProjectError, cloneProject(), touchProject() (+18 more)

### Community 230 - "Community 230"
Cohesion: 0.67
Nodes (2): baseLayer, parseProject()

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (48): TransformSchema, BlendModeSchema, ShadowSchema, InnerShadowSchema, StrokeSchema, GlowSchema, FilterSchema, LevelsChannelSchema (+40 more)

### Community 133 - "Community 133"
Cohesion: 0.15
Nodes (14): SelectionType, SelectionMode, SelectionBounds, Selection, MagicWandOptions, ColorRangeOptions, SelectionState, DEFAULT_MAGIC_WAND_OPTIONS (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (20): stringToPtr(), stringsToPtr(), exec(), receiveProgress(), send_progress(), ExceptionInfo(), ___cxa_throw(), doCallback() (+12 more)

### Community 191 - "Community 191"
Cohesion: 0.25
Nodes (8): setTimeout(), preRun(), initRuntime(), postRun(), addOnPreRun(), addOnPostRun(), callRuntimeCallbacks(), run()

### Community 171 - "Community 171"
Cohesion: 0.18
Nodes (11): assert(), abort(), getBinary(), getValue(), setValue(), ___dlsym(), initRandomFill(), randomFill() (+3 more)

### Community 214 - "Community 214"
Cohesion: 0.40
Nodes (5): updateMemoryViews(), getHeapMax(), _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap()

### Community 222 - "Community 222"
Cohesion: 0.50
Nodes (4): keepRuntimeAlive(), ExitStatus(), _proc_exit(), exitJS()

### Community 180 - "Community 180"
Cohesion: 0.27
Nodes (10): getUniqueRunDependency(), addRunDependency(), isDataURI(), isFileURI(), getBinaryPromise(), instantiateArrayBuffer(), instantiateAsync(), createWasm() (+2 more)

### Community 144 - "Community 144"
Cohesion: 0.13
Nodes (15): getWasmTableEntry(), invoke_iiiii(), invoke_vii(), invoke_iii(), invoke_iiiijj(), invoke_iiiiiiiii(), invoke_vi(), invoke_viiii() (+7 more)

### Community 197 - "Community 197"
Cohesion: 0.29
Nodes (7): UTF8ArrayToString(), UTF8ToString(), ___assert_fail(), inetPton4(), jstoi_q(), inetPton6(), _getaddrinfo()

### Community 172 - "Community 172"
Cohesion: 0.22
Nodes (11): lengthBytesUTF8(), stringToUTF8Array(), intArrayFromString(), inetNtop4(), inetNtop6(), readSockaddr(), stringToUTF8(), ___syscall_getdents64() (+3 more)

### Community 143 - "Community 143"
Cohesion: 0.18
Nodes (15): zeroMemory(), alignMemory(), mmapAlloc(), getSocketFromFD(), writeSockaddr(), ___syscall_accept4(), getSocketAddress(), ___syscall_bind() (+7 more)

### Community 179 - "Community 179"
Cohesion: 0.20
Nodes (10): readI53FromI64(), __gmtime_js(), isLeapYear(), ydayFromDate(), __localtime_js(), __mktime_js(), arraySum(), addDays() (+2 more)

### Community 215 - "Community 215"
Cohesion: 0.40
Nodes (5): getExecutableName(), getEnvStrings(), stringToAscii(), _environ_get(), _environ_sizes_get()

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (26): i(), C, L(), P, D(), M(), R(), j() (+18 more)

### Community 100 - "Community 100"
Cohesion: 0.15
Nodes (6): T(), U(), te, wn(), vn, Un

### Community 71 - "Community 71"
Cohesion: 0.11
Nodes (5): E, N(), mn, Dn, gs

### Community 208 - "Community 208"
Cohesion: 0.33
Nodes (1): Y

### Community 229 - "Community 229"
Cohesion: 0.67
Nodes (1): se

### Community 173 - "Community 173"
Cohesion: 0.20
Nodes (3): Le(), We, Ge()

### Community 148 - "Community 148"
Cohesion: 0.18
Nodes (1): De

### Community 112 - "Community 112"
Cohesion: 0.19
Nodes (1): et

### Community 149 - "Community 149"
Cohesion: 0.21
Nodes (3): pt(), gt, mt

### Community 70 - "Community 70"
Cohesion: 0.11
Nodes (4): bt(), vt(), xt, kt()

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (1): wt

### Community 165 - "Community 165"
Cohesion: 0.29
Nodes (1): cn

### Community 224 - "Community 224"
Cohesion: 0.50
Nodes (1): Tn

### Community 30 - "Community 30"
Cohesion: 0.10
Nodes (1): En

### Community 145 - "Community 145"
Cohesion: 0.16
Nodes (4): Rn, jn, qn, zn

### Community 106 - "Community 106"
Cohesion: 0.12
Nodes (4): Bn, Hn, Gn, Kn

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (2): Xn, ls

### Community 223 - "Community 223"
Cohesion: 0.50
Nodes (1): ms

### Community 236 - "Community 236"
Cohesion: 1.00
Nodes (1): ASSETS

### Community 33 - "Community 33"
Cohesion: 0.09
Nodes (23): AudioMixer(), ChannelStripProps, MasterChannelStripProps, HELP_SECTIONS, HelpModal(), HelpTooltipManager(), PreviewCanvas(), PropertiesPanel() (+15 more)

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (28): AiMotionGraphicsProps, AiMotionGraphicsDesigner(), CueWithOptions, AICueResult, AiSoundDesignerProps, AiSoundDesigner(), ColorWheelProps, PRESETS (+20 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (35): ColorScopesProps, ColorScopes(), ThumbnailModalProps, TextLayer, ThumbnailModal(), LutData, ClipParticleSettings, loadMediaPipe() (+27 more)

### Community 178 - "Community 178"
Cohesion: 0.22
Nodes (6): ffmpeg, ffmpegLogs, ExportStatus, ExportModal(), formatTime(), formatSimpleTime()

### Community 40 - "Community 40"
Cohesion: 0.07
Nodes (26): TRANSITIONS, FX_EFFECTS, COLOR_CORRECTION_EFFECTS, PARTICLE_EFFECTS, TEXT_TEMPLATES, MediaPanel(), TransitionCardProps, TranscriptPanel() (+18 more)

### Community 67 - "Community 67"
Cohesion: 0.10
Nodes (14): getTrackHeight(), getTrackTop(), getTrackAtY(), formatDetailedTooltipTime(), seededRandom(), generateFallbackWaveform(), CLIP_COLORS, FrameStripOverlay() (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (30): WelcomeScreen(), checkOverlap(), findNonOverlappingPosition(), EditorActions, defaultTracks, initialState, EditorSnapshot, ProjectTemplate (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (3): badgeVariants, Badge(), cn()

### Community 218 - "Community 218"
Cohesion: 0.50
Nodes (2): alertVariants, Alert()

### Community 107 - "Community 107"
Cohesion: 0.13
Nodes (7): buttonGroupVariants, ButtonGroup(), itemVariants, Item(), itemMediaVariants, ItemMedia(), Separator()

### Community 59 - "Community 59"
Cohesion: 0.09
Nodes (15): buttonVariants, Button(), CarouselApi, UseCarouselParameters, CarouselOptions, CarouselPlugin, CarouselProps, CarouselContextProps (+7 more)

### Community 174 - "Community 174"
Cohesion: 0.22
Nodes (7): THEMES, ChartConfig, ChartContextProps, ChartContext, useChart(), ChartTooltipContent(), ChartLegendContent()

### Community 101 - "Community 101"
Cohesion: 0.12
Nodes (5): Dialog(), DialogContent(), DialogHeader(), DialogTitle(), DialogDescription()

### Community 195 - "Community 195"
Cohesion: 0.29
Nodes (2): emptyMediaVariants, EmptyMedia()

### Community 77 - "Community 77"
Cohesion: 0.10
Nodes (12): fieldVariants, Field(), FormFieldContextValue, FormFieldContext, useFormField(), FormItemContextValue, FormItemContext, FormLabel() (+4 more)

### Community 157 - "Community 157"
Cohesion: 0.21
Nodes (6): inputGroupAddonVariants, InputGroupAddon(), inputGroupButtonVariants, InputGroupButton(), Input(), Textarea()

### Community 183 - "Community 183"
Cohesion: 0.22
Nodes (2): navigationMenuTriggerStyle, NavigationMenuTrigger()

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (19): Sheet(), SheetContent(), SheetHeader(), SheetTitle(), SheetDescription(), SidebarContextProps, SidebarContext, useSidebar() (+11 more)

### Community 202 - "Community 202"
Cohesion: 0.38
Nodes (3): ToggleGroupContext, toggleVariants, Toggle()

### Community 87 - "Community 87"
Cohesion: 0.13
Nodes (19): trackAnalysers, getMasterAudioCtx(), MediaElement, FrameCacheEntry, MediaPlaybackResult, useMediaPlayback(), getOrCreateTrackAnalyser(), connectAudioNode() (+11 more)

### Community 231 - "Community 231"
Cohesion: 0.67
Nodes (2): ClipColorFilters, calculateAutoColor()

### Community 156 - "Community 156"
Cohesion: 0.18
Nodes (7): ClipAudioSettings, SeparationMode, SeparationSettings, defaultSettings, createSeparationNode(), updateSeparationParam(), createFallbackSeparationNode()

### Community 232 - "Community 232"
Cohesion: 0.67
Nodes (1): AutoCutSegment

### Community 220 - "Community 220"
Cohesion: 0.40
Nodes (1): frameCache

### Community 184 - "Community 184"
Cohesion: 0.40
Nodes (9): generateId(), blobUrlToArrayBuffer(), captureVideoFrame(), probeVideo(), extractWaveformFromUrl(), probeAudio(), probeImage(), detectMediaType() (+1 more)

### Community 213 - "Community 213"
Cohesion: 0.53
Nodes (5): WaveformRenderOptions, renderWaveform(), roundRect(), createWaveformCanvas(), renderWaveformToDataUrl()

### Community 237 - "Community 237"
Cohesion: 1.00
Nodes (1): a

## Knowledge Gaps
- **708 isolated node(s):** `ACTION_DESCRIPTIONS`, `AUTO_GROUPABLE_TYPES`, `TARGET_PARAM_KEYS`, `AspectRatioPreset`, `PlatformPreset` (+703 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 84`** (1 nodes): `ActionExecutor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 140`** (1 nodes): `ActionValidator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 117`** (1 nodes): `InverseActionGenerator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 120`** (1 nodes): `AutoReframeEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (1 nodes): `BackgroundRemovalEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `CompositionRenderer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `SegmentedAudioDecoder`, `AudioEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 121`** (2 nodes): `BeatDetectionEngine`, `disposeBeatDetectionEngine()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 190`** (2 nodes): `TestAudioBuffer`, `NoiseProfile`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (1 nodes): `SpectralNoiseReducer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `SoundGenerator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (2 nodes): `SoundLibraryEngine`, `createSoundLibraryEngine()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 221`** (2 nodes): `EDITING_TEMPLATE_CATEGORIES`, `EditingTemplateCategoryDefinition`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 123`** (2 nodes): `ExpressionContext`, `ExpressionEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `ExportEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `GraphicsEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `StickerLibrary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 217`** (1 nodes): `AudioMatchEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `FFmpegFallback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `ExportFrameDecoder`, `MediaBunnyEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 200`** (2 nodes): `TranscriptionWord`, `TranscriptionEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 124`** (2 nodes): `WaveformGenerator`, `createWaveformGenerator()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `PhotoEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 147`** (1 nodes): `CacheManager`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 135`** (2 nodes): `ProjectSerializer`, `createProjectSerializer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (2 nodes): `TemplateEngine`, `createTemplateEngine()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `TextAnimationEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `TitleEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (2 nodes): `generateId()`, `NestedSequenceEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 126`** (1 nodes): `TrackManager`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 151`** (1 nodes): `Result`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 226`** (1 nodes): `generateId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 114`** (2 nodes): `Canvas2DFallbackRenderer`, `Renderer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (1 nodes): `FrameCache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 185`** (1 nodes): `PreloadManager`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 198`** (1 nodes): `FlowFieldCache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 164`** (2 nodes): `FrameInterpolationEngine`, `getFrameInterpolationEngine()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 192`** (1 nodes): `OpticalFlowCPU`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `KeyframeEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 233`** (2 nodes): `interpolatePaths()`, `applyEasing()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `MaskEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 169`** (1 nodes): `TransformAnimator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `TransitionEngine`, `createTransitionEngine()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `UpscalingEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 116`** (1 nodes): `WebGPUEffectsProcessor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `WebGPURenderer`, `Renderer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 239`** (2 nodes): `GPUDevice`, `EventTarget`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 163`** (1 nodes): `WasmFFT`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 211`** (1 nodes): `UpdateLayerTransformCommand`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 210`** (1 nodes): `UpdateLayerStyleCommand`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 212`** (1 nodes): `UpdateTextCommand`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 209`** (1 nodes): `ApplyAdjustmentCommand`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (2 nodes): `PasteLayersCommand`, `RemovePastedLayersCommand`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 230`** (2 nodes): `baseLayer`, `parseProject()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 208`** (1 nodes): `Y`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 229`** (1 nodes): `se`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 148`** (1 nodes): `De`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (1 nodes): `et`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `wt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 165`** (1 nodes): `cn`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 224`** (1 nodes): `Tn`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `En`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (2 nodes): `Xn`, `ls`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 223`** (1 nodes): `ms`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 236`** (1 nodes): `ASSETS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 218`** (2 nodes): `alertVariants`, `Alert()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 195`** (2 nodes): `emptyMediaVariants`, `EmptyMedia()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (2 nodes): `navigationMenuTriggerStyle`, `NavigationMenuTrigger()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 231`** (2 nodes): `ClipColorFilters`, `calculateAutoColor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 232`** (1 nodes): `AutoCutSegment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 220`** (1 nodes): `frameCache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 237`** (1 nodes): `a`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VideoEngine` connect `Community 2` to `Community 85`, `Community 11`, `Community 4`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `GraphicsEngine` connect `Community 57` to `Community 85`, `Community 18`, `Community 216`, `Community 207`, `Community 199`, `Community 181`, `Community 228`, `Community 9`, `Community 4`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Effect` connect `Community 4` to `Community 74`, `Community 75`, `Community 142`, `Community 39`, `Community 132`, `Community 111`, `Community 99`, `Community 9`, `Community 41`, `Community 88`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `ACTION_DESCRIPTIONS`, `AUTO_GROUPABLE_TYPES`, `TARGET_PARAM_KEYS` to the rest of the system?**
  _708 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 53` be split into smaller, more focused modules?**
  _Cohesion score 0.10114942528735632 - nodes in this community are weakly interconnected._
- **Should `Community 129` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 80` be split into smaller, more focused modules?**
  _Cohesion score 0.12666666666666668 - nodes in this community are weakly interconnected._