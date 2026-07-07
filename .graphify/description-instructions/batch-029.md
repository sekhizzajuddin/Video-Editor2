# Node Description Batch 30 of 128

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

- "ffmpeg_ffmpeg_core_inetntop6": "inetNtop6()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, inetNtop4(), readSockaddr()]
- "ffmpeg_ffmpeg_core_inetpton4": "inetPton4()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _getaddrinfo(), writeSockaddr()]
- "ffmpeg_ffmpeg_core_initrandomfill": "initRandomFill()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, abort(), randomFill()]
- "ffmpeg_ffmpeg_core_instantiatearraybuffer": "instantiateArrayBuffer()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getBinaryPromise(), instantiateAsync()]
- "ffmpeg_ffmpeg_core_isfileuri": "isFileURI()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getBinaryPromise(), instantiateAsync()]
- "ffmpeg_ffmpeg_core_lengthbytesutf8": "lengthBytesUTF8()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, intArrayFromString(), stringToNewUTF8()]
- "ffmpeg_ffmpeg_core_localtime_js": "__localtime_js()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, readI53FromI64(), ydayFromDate()]
- "ffmpeg_ffmpeg_core_mmapalloc": "mmapAlloc()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, alignMemory(), zeroMemory()]
- "ffmpeg_ffmpeg_core_postrun": "postRun()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, addOnPostRun(), callRuntimeCallbacks()]
- "ffmpeg_ffmpeg_core_readi53fromi64": "readI53FromI64()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, __gmtime_js(), __localtime_js()]
- "ffmpeg_ffmpeg_core_run": "run()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, preRun(), setTimeout()]
- "ffmpeg_ffmpeg_core_runemasmfunction": "runEmAsmFunction()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, _emscripten_asm_const_int(), readEmAsmArgs()]
- "ffmpeg_ffmpeg_core_stringstoptr": "stringsToPtr()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, exec(), stringToPtr()]
- "ffmpeg_ffmpeg_core_stringtoutf8array": "stringToUTF8Array()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, intArrayFromString(), stringToUTF8()]
- "ffmpeg_ffmpeg_core_syscall_accept4": "___syscall_accept4()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketFromFD(), writeSockaddr()]
- "ffmpeg_ffmpeg_core_syscall_bind": "___syscall_bind()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketAddress(), getSocketFromFD()]
- "ffmpeg_ffmpeg_core_syscall_connect": "___syscall_connect()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketAddress(), getSocketFromFD()]
- "ffmpeg_ffmpeg_core_syscall_getpeername": "___syscall_getpeername()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketFromFD(), writeSockaddr()]
- "ffmpeg_ffmpeg_core_syscall_getsockname": "___syscall_getsockname()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketFromFD(), writeSockaddr()]
- "ffmpeg_ffmpeg_core_syscall_recvfrom": "___syscall_recvfrom()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketFromFD(), writeSockaddr()]
- "ffmpeg_ffmpeg_core_syscall_sendto": "___syscall_sendto()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, getSocketAddress(), getSocketFromFD()]
- "ffmpeg_ffmpeg_core_zeromemory": "zeroMemory()" | kind=code-symbol | source=public/ffmpeg/ffmpeg-core.js:L8 | neighbors=[ffmpeg-core.js, mmapAlloc(), writeSockaddr()]
- "fft_index_wasmfft_ensurewasm": ".ensureWasm()" | kind=code-symbol | source=packages/core/src/wasm/fft/index.ts:L107 | neighbors=[preloadWasmFFT(), WasmFFT, initWasmFFT()]
- "frame_interpolation_frame_interpolation_engine_disposeframeinterpolationengine": "disposeFrameInterpolationEngine()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L222 | neighbors=[frame-interpolation-engine.ts, .dispose(), index.ts]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_dispose": ".dispose()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L205 | neighbors=[disposeFrameInterpolationEngine(), FrameInterpolationEngine, .setQuality()]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_extractpixeldata": ".extractPixelData()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L123 | neighbors=[FrameInterpolationEngine, .interpolate(), .warpFrames()]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_initialize": ".initialize()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L23 | neighbors=[FrameInterpolationEngine, .setQuality(), getFrameInterpolationEngine()]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_setquality": ".setQuality()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L37 | neighbors=[FrameInterpolationEngine, .dispose(), .initialize()]
- "frame_interpolation_frame_interpolation_engine_frameinterpolationengine_warpframes": ".warpFrames()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/frame-interpolation-engine.ts:L139 | neighbors=[FrameInterpolationEngine, .interpolate(), .extractPixelData()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_blockmatch": ".blockMatch()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L130 | neighbors=[OpticalFlowCPU, .computeSAD(), .computeFlowField()]
- "frame_interpolation_optical_flow_cpu_opticalflowcpu_computeflowfield": ".computeFlowField()" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/optical-flow-cpu.ts:L10 | neighbors=[OpticalFlowCPU, .blockMatch(), .buildPyramid()]
- "frame_interpolation_types_frameinterpolationresult": "FrameInterpolationResult" | kind=code-symbol | source=packages/core/src/video/frame-interpolation/types.ts:L14 | neighbors=[frame-interpolation-engine.ts, index.ts, types.ts]
- "graphics_graphics_engine_graphicsengine_generateid": ".generateId()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1702 | neighbors=[GraphicsEngine, .createShape(), .importSVG()]
- "graphics_graphics_engine_graphicsengine_getanimatedtransform": ".getAnimatedTransform()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1564 | neighbors=[GraphicsEngine, .getAnimatedGraphicState(), .setNestedProperty()]
- "graphics_graphics_engine_graphicsengine_importsvg": ".importSVG()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L323 | neighbors=[GraphicsEngine, .generateId(), .parseSVG()]
- "graphics_graphics_engine_graphicsengine_loadimage": ".loadImage()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L1684 | neighbors=[GraphicsEngine, .renderSticker(), .renderSVG()]
- "graphics_graphics_engine_graphicsengine_rendersticker": ".renderSticker()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L711 | neighbors=[GraphicsEngine, .renderGraphic(), .loadImage()]
- "graphics_graphics_engine_graphicsengine_updateshapestyle": ".updateShapeStyle()" | kind=code-symbol | source=packages/core/src/graphics/graphics-engine.ts:L210 | neighbors=[GraphicsEngine, .updateFill(), .updateStroke()]
- "graphics_sticker_library_stickerlibrary_getallemojis": ".getAllEmojis()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L269 | neighbors=[StickerLibrary, .getEmoji(), .searchEmojis()]
- "graphics_sticker_library_stickerlibrary_importsticker": ".importSticker()" | kind=code-symbol | source=packages/core/src/graphics/sticker-library.ts:L350 | neighbors=[StickerLibrary, .addSticker(), .fileToDataUrl()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: D:\Video-Editor\.graphify\description-instructions\batch-029.json

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
