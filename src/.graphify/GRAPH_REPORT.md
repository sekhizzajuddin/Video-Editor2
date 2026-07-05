# Graph Report - src  (2026-07-05)

## Corpus Check
- 90 files · ~1,13,250 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 622 nodes · 964 edges · 25 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 533 · imports: 199 · imports_from: 144 · calls: 87 · inherits: 1


## Input Scope
- Requested: auto
- Resolved: all (source: default-auto)
- Included files: 90 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed
## God Nodes (most connected - your core abstractions)
1. `cn()` - 51 edges
2. `useEditorStore` - 12 edges
3. `getDB()` - 12 edges
4. `probeFile()` - 9 edges
5. `Button()` - 7 edges
6. `MediaItem` - 6 edges
7. `restoreSnapshotMedia()` - 6 edges
8. `getSpeedAtPosition()` - 6 edges
9. `getMediaTimeAtPosition()` - 6 edges
10. `buttonVariants` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (49): COLOR_CORRECTION_EFFECTS, FX_EFFECTS, PARTICLE_EFFECTS, TEXT_TEMPLATES, TransitionCardProps, TRANSITIONS, ClipAnimations, ClipChromaKeySettings (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (39): AudioMixer(), ChannelStripProps, MasterChannelStripProps, MediaPanel(), PreviewCanvas(), PropertiesPanel(), SettingsModal(), TopToolbar() (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (19): useIsMobile(), Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetTitle(), Sidebar(), SidebarContext (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (19): ButtonGroup(), buttonGroupVariants, Field(), fieldVariants, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (20): ExportModal(), ExportStatus, ffmpeg, ffmpegLogs, CLIP_COLORS, FloatingScrubTooltip(), formatDetailedTooltipTime(), FrameStripOverlay() (+12 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (3): cn(), Badge(), badgeVariants

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (14): clearPreviewCaches(), getCachedImage(), hexToRgb(), imageCache, imageLoading, InteractiveCanvasOverlay(), LocalCornerPoints, Particle (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (5): Dialog(), DialogContent(), DialogDescription(), DialogHeader(), DialogTitle()

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (12): AICueResult, AiSoundDesigner(), AiSoundDesignerProps, CueWithOptions, ColorWheelProps, PRESETS, useEditorStore, AICueResult (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (3): Button(), buttonVariants, PaginationLinkProps

### Community 13 - "Community 13"
Cohesion: 0.20
Nodes (11): connectAudioNode(), createSeparationGraph(), FrameCacheEntry, getMasterAudioCtx(), getOrCreateTrackAnalyser(), initAudioGraph(), MediaElement, MediaPlaybackResult (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (12): CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions, CarouselPlugin (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (7): ClipAudioSettings, createFallbackSeparationNode(), createSeparationNode(), defaultSettings, SeparationMode, SeparationSettings, updateSeparationParam()

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (6): InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, Input(), Textarea()

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (7): ChartConfig, ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), THEMES, useChart()

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (2): NavigationMenuTrigger(), navigationMenuTriggerStyle

### Community 22 - "Community 22"
Cohesion: 0.36
Nodes (8): SpeedRampKeyframe, getFullKeyframes(), getIntegralTable(), getMediaTimeAtPosition(), getMediaTimeForClip(), getSpeedAtPosition(), integralCache, IntegralCacheEntry

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (2): EmptyMedia(), emptyMediaVariants

### Community 27 - "Community 27"
Cohesion: 0.38
Nodes (6): CornerPoints, getGrayscalePatch(), matchTemplate(), Point, trackMotion(), TrackProgressCallback

### Community 28 - "Community 28"
Cohesion: 0.38
Nodes (3): ToggleGroupContext, Toggle(), toggleVariants

### Community 29 - "Community 29"
Cohesion: 0.53
Nodes (5): createWaveformCanvas(), renderWaveform(), renderWaveformToDataUrl(), roundRect(), WaveformRenderOptions

### Community 30 - "Community 30"
Cohesion: 0.50
Nodes (2): Alert(), alertVariants

### Community 34 - "Community 34"
Cohesion: 0.40
Nodes (1): frameCache

### Community 35 - "Community 35"
Cohesion: 0.50
Nodes (3): PropertyKeyframe, addOrUpdateKeyframe(), getAnimatedValue()

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (3): compileGridForSegment(), compileStoryboard(), StoryboardChunk

## Knowledge Gaps
- **78 isolated node(s):** `AiSoundDesignerProps`, `ChannelStripProps`, `MasterChannelStripProps`, `ffmpeg`, `ffmpegLogs` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 21`** (2 nodes): `NavigationMenuTrigger()`, `navigationMenuTriggerStyle`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `EmptyMedia()`, `emptyMediaVariants`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `Alert()`, `alertVariants`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `frameCache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 5` to `Community 30`, `Community 17`, `Community 24`, `Community 12`, `Community 3`, `Community 25`, `Community 14`, `Community 18`, `Community 7`, `Community 10`, `Community 19`, `Community 11`, `Community 26`, `Community 37`, `Community 16`, `Community 31`, `Community 9`, `Community 21`, `Community 32`, `Community 38`, `Community 20`, `Community 2`, `Community 23`, `Community 33`, `Community 28`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `useEditorStore` connect `Community 8` to `Community 1`, `Community 4`, `Community 0`, `Community 6`, `Community 13`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Button()` connect `Community 12` to `Community 14`, `Community 16`, `Community 2`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `AiSoundDesignerProps`, `ChannelStripProps`, `MasterChannelStripProps` to the rest of the system?**
  _78 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05325814536340852 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07256894049346879 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05585106382978723 - nodes in this community are weakly interconnected._