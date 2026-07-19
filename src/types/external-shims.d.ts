/**
 * Ambient module declarations for runtime-only dependencies.
 *
 * Why this file exists:
 * `src/utils/ai-copilot/testDefinitions.ts` performs dynamic
 * `await import('packages/core/src/...')` to poll optional modules. Because
 * TypeScript still type-checks imported files (via tsconfig
 * `include: ["src"]` + recursive resolution), every transitive dep must be
 * resolvable at build time. Several of those packages
 *   (mediabunny, @mediapipe/tasks-vision, GSAP, etc.)
 * are installed only under `packages/core/node_modules` and never hoisted
 * to the root, which makes `tsc -b` fail with TS2307.
 *
 * At runtime these modules are loaded dynamically via CDN URLs (see
 * `packages/core/src/video/decode-worker.ts`). We don't need full type
 * information, just enough to silence the compiler. We declare modules as
 * flat objects of `any` members so both `import X from 'm'` and
 * `m.SomeName` work uniformly.
 *
 * Sync with: Vite bundler config; these shims are for type-check only.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'mediabunny' {
  export const Input: any;
  export const Output: any;
  export const Mp4OutputFormat: any;
  export const Mp3OutputFormat: any;
  export const WebMOutputFormat: any;
  export const MovOutputFormat: any;
  export const AudioBufferSink: any;
  export const AudioSampleSink: any;
  export const BlobSource: any;
  export const CanvasSink: any;
  export const VideoSampleSink: any;
  export const ALL_FORMATS: any;
  export const BufferTarget: any;
  export const StreamTarget: any;
  export const VideoSampleSource: any;
  export const AudioSampleSource: any;
  export const AudioBufferSource: any;
  export const VideoSample: any;
  export const AudioSample: any;
  export const Conversion: any;
  // Use interface so instance properties are visible (TS class type omits
  // them until explicitly declared; but TS treats `class X {}` as a constructor
  // type which doesn't expose instance props). Use interface with [key: any].
  export interface InputVideoTrack {
    [key: string]: any;
  }
  export interface InputAudioTrack {
    [key: string]: any;
  }
  export interface WrappedAudioBuffer {
    [key: string]: any;
  }
  export interface ConversionOptions {
    [key: string]: any;
  }
  export const getFirstEncodableAudioCodec: any;
  export const getFirstEncodableVideoCodec: any;
  export const getEncodableVideoCodecs: any;
  export const getEncodableAudioCodecs: any;
  export const QUALITY_MEDIUM: any;
  export const QUALITY_HIGH: any;
  /// <reference path="..." /> gives `default` shape
  const __mediabunny__: any;
  export default __mediabunny__;
}

declare module '@mediapipe/tasks-vision' {
  export const ImageSegmenter: any;
  export const FilesetResolver: any;
  export const ImageEmbedder: any;
  export const FaceDetector: any;
  export const PoseLandmarker: any;
  export const HandLandmarker: any;
  export type ImageSegmenterOptions = any;
  export type Embedding = any;
  export type Category = any;
  export type Detection = any;
  export type NormalizedLandmark = any;
  export type Landmark = any;
  const __mediapipe__: any;
  export default __mediapipe__;
}

declare module '@huggingface/transformers' {
  const value: any;
  export = value;
}

declare module '@ffmpeg/ffmpeg' {
  // FFmpeg class used as both value (new FFmpeg()) and namespace import.
  // We declare it as a `const` type with both interface and new-callable
  // signature, allowing `import { FFmpeg }` and `new FFmpeg()` patterns.
  export interface FFmpegClass {
    // Constructor (callable as `new FFmpeg()`)
    new (): FFmpegClass;
    // Static property for prototypes if needed
    prototype: FFmpegClass;
  }
  // Merged into the FFmpegClass for instance access on constructor.
  export interface FFmpegClass extends FFmpeg {}
  // Use interface so instance fields are visible.
  interface FFmpeg {
    loaded: boolean;
    load: (...args: any[]) => Promise<boolean>;
    on: (event: 'log' | 'progress' | 'done' | string, callback: (...args: any[]) => void) => void;
    off: (event: string, callback: (...args: any[]) => void) => void;
    writeFile: (path: string, data: any) => Promise<void>;
    readFile: (path: string) => Promise<Uint8Array | string>;
    deleteFile: (path: string) => Promise<void>;
    exec: (args: any[]) => Promise<number>;
    terminate: () => void;
    [key: string]: any;
  }
  // The exported FFmpeg value is the class itself (callable + namespace).
  export const FFmpeg: FFmpegClass;
  const value: {
    FFmpeg: typeof FFmpeg;
    [key: string]: any;
  };
  export = value;
}

declare module '@ffmpeg/util' {
  // Functions, exposed as both class-shaped (typeof) and call values
  export function toBlobURL(url: string, mimeType?: string): Promise<string>;
  export function fetchFile(file: any): Promise<Uint8Array>;
  const value: {
    toBlobURL: typeof toBlobURL;
    fetchFile: typeof fetchFile;
    [key: string]: any;
  };
  export = value;
}

declare module '@gradio/client' {
  export const Client: any;
  export const handle_return: any;
  const __default__: any;
  export default __default__;
}

declare module '@imgly/background-removal' {
  export const removeBackground: any;
  export const load: any;
  export const config: any;
  const __default__: any;
  export default __default__;
}

declare module 'transliteration' {
  const value: any;
  export default value;
}

declare module '@indic-transliteration/sanscript' {
  const value: any;
  export default value;
}

declare module 'gsap' {
  export const gsap: any;
  export const TimelineLite: any;
  export const TimelineMax: any;
  export const TweenLite: any;
  export const TweenMax: any;
  export default { gsap, TimelineLite, TimelineMax, TweenLite, TweenMax };
}

declare module 'idb-keyval' {
  export const get: any;
  export const set: any;
  export const del: any;
  export const clear: any;
  export const keys: any;
  export const values: any;
  export const entries: any;
  export const createStore: any;
  export const getMany: any;
  export const setMany: any;
  export const delMany: any;
  export const update: any;
}

declare module 'immer' {
  export const produce: any;
  export const immerable: any;
  export const isDraft: any;
  export const original: any;
  export const current: any;
  export const freeze: any;
  export const nothing: any;
  export const castDraft: any;
  export const castImmutable: any;
}

declare module 'assemblyscript' {
  const value: any;
  export = value;
}

declare module 'demucs-web' {
  const value: any;
  export = value;
}

declare module 'onnxruntime-web' {
  const value: any;
  export = value;
}

declare module 'uuid' {
  export const v1: any;
  export const v3: any;
  export const v4: any;
  export const v5: any;
  export const NIL: any;
  export function parse(uuid: string): any;
  export function stringify(uuid: any, offset?: number): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
}

// ---- WebGPU ambient globals (DOM lib doesn't include them pre-future) ----
interface AnyRecord {
  [key: string]: any;
}

interface GPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

interface GPUAdapter {
  readonly features: Set<string>;
  readonly limits: { [key: string]: number };
  readonly info?: GPUAdapterInfo;
  requestDevice(): Promise<GPUDevice>;
  requestDevice(descriptor?: any): Promise<GPUDevice>;
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
  forceFallbackAdapter?: boolean;
}

interface GPUDeviceLostInfo {
  reason: 'unknown' | 'destroyed' | string;
  message: string;
}

interface GPUError {
  message: string;
}

interface GPUBuffer {
  readonly size: number;
  readonly usage: number;
  readonly label?: string;
  destroy(): void;
  mapState: 'unmapped' | 'pending' | 'mapped';
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
}

interface GPUMapMode {
  readonly READ: 1;
  readonly WRITE: 2;
}

interface GPUTexture {
  readonly width: number;
  readonly height: number;
  readonly depthOrArrayLayers: number;
  readonly mipLevelCount: number;
  readonly sampleCount: number;
  readonly dimension: string;
  readonly format: string;
  readonly usage: number;
  readonly label?: string;
  createView(descriptor?: any): GPUTextureView;
  destroy(): void;
}

interface GPUTexelCopyBufferLayout {
  offset?: number;
  bytesPerRow: number;
  rowsPerImage: number;
}

interface GPUExtent3D {
  width: number;
  height: number;
  depthOrArrayLayers: number;
}

interface GPUOrigin3D {
  x: number;
  y: number;
  z: number;
}

interface GPTexelCopyTextureInfo {
  texture: GPUTexture;
  mipLevel: number;
  origin?: GPUOrigin3D | AnyRecord;
  aspect?: 'all' | 'stencil-only' | 'depth-only';
}

interface GPUCopyTextureToTexture {
  source: GPTexelCopyTextureInfo;
  destination: GPTexelCopyTextureInfo;
  copySize: GPUExtent3D;
}

interface GPUBindGroupLayoutEntry {
  binding: number;
  visibility: number;
  buffer?: any;
  sampler?: any;
  texture?: any;
  storageTexture?: any;
  label?: string;
}

interface GPUBindGroupLayoutDescriptor {
  label?: string;
  entries: GPUBindGroupLayoutEntry[];
}

interface GPUBufferBinding {
  buffer: GPUBuffer;
  offset?: number;
  size?: number;
}

interface GPUBindGroupEntry {
  binding: number;
  resource: any;
}

interface GPUBindGroupDescriptor {
  label?: string;
  layout: GPUBindGroupLayout;
  entries: GPUBindGroupEntry[];
}

interface GPUBindGroup {
  /* placeholder */
}

interface GPUBindGroupLayout {
  /* placeholder */
}

interface GPUDevice {
  readonly features: Set<string>;
  readonly limits: { [key: string]: number };
  readonly queue: GPUQueue;
  readonly lost: Promise<GPUDeviceLostInfo>;
  readonly label?: string;
  createBuffer(descriptor: { size: number; usage: number; mappedAtCreation?: boolean; label?: string }): GPUBuffer;
  createTexture(descriptor: any): GPUTexture;
  createShaderModule(descriptor: { code: string; label?: string } | any): GPUShaderModule;
  createComputePipeline(descriptor: any): GPUComputePipeline;
  createRenderPipeline(descriptor: any): any;
  createPipelineLayout(descriptor: any): any;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createCommandEncoder(descriptor?: any): GPUCommandEncoder;
  createSampler(descriptor?: any): GPUSampler;
  pushErrorScope(filter: 'out-of-memory' | 'validation' | 'internal'): void;
  popErrorScope(): Promise<GPUError | null>;
  destroy(): void;
}

interface GPUComputePipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
  label?: string;
}

interface GPUQueue {
  submit(commandBuffers: any[]): void;
  onSubmittedWorkDone(): Promise<void>;
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: ArrayBuffer | ArrayBufferView): void;
  writeTexture(destination: any, data: ArrayBuffer | ArrayBufferView, dataLayout: any, size: any): void;
  copyExternalImageToTexture(source: any, destination: any, copySize: any): void;
}

interface GPUCommandBuffer {
  /* placeholder */
  label?: string;
}

interface GPUCommandEncoder {
  beginComputePass(descriptor?: any): GPUComputePassEncoder;
  beginRenderPass(descriptor: any): any;
  finish(): GPUCommandBuffer;
  copyBufferToTexture(
    source: { buffer: GPUBuffer; offset?: number; bytesPerRow: number; rowsPerImage: number },
    destination: { texture: GPUTexture; mipLevel?: number; origin?: any; aspect?: string },
    copySize: { width: number; height?: number; depthOrArrayLayers?: number }
  ): void;
  copyTextureToBuffer(
    source: { texture: GPUTexture; mipLevel?: number; origin?: any; aspect?: string },
    destination: { buffer: GPUBuffer; offset?: number; bytesPerRow: number; rowsPerImage: number },
    copySize: { width: number; height?: number; depthOrArrayLayers?: number }
  ): void;
  copyBufferToBuffer(
    source: { buffer: GPUBuffer; offset?: number },
    destination: { buffer: GPUBuffer; offset?: number },
    size: number
  ): void;
  copyTextureToTexture(source: any, destination: any, copySize: any): void;
  label?: string;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  dispatchWorkgroupsIndirect(indirectBuffer: GPUBuffer, indirectOffset?: number): void;
  end(): void;
  label?: string;
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: any): void;
  setBindGroup(index: number, bindGroup: any, dynamicOffsets?: number[]): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): void;
  drawIndirect(indirectBuffer: GPUBuffer, indirectOffset?: number): void;
  drawIndexedIndirect(indirectBuffer: GPUBuffer, indirectOffset?: number): void;
  end(): void;
  label?: string;
}

interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
  label?: string;
  [key: string]: any;
}

interface GPUSampler {
  /* placeholder */
  [key: string]: any;
}

interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
  label?: string;
  [key: string]: any;
}

interface GPUCanvasContext {
  configure(config: any): void;
  getCurrentTexture(): GPUTexture;
  [key: string]: any;
}

interface GPUTextureFormat {
  [key: string]: any;
}

interface HTMLCanvasElement {
  getContext(contextId: '2d', options?: any): CanvasRenderingContext2D | null;
  getContext(contextId: 'webgl', options?: any): WebGLRenderingContext | null;
  getContext(contextId: 'webgpu', options?: any): GPUCanvasContext | null;
  getContext(contextId: string, options?: any): any;
}

interface GPUColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): string;
}

interface Navigator {
  gpu?: GPU;
}

declare const GPUBufferUsage: {
  MAP_READ: 1;
  MAP_WRITE: 2;
  COPY_SRC: 4;
  COPY_DST: 8;
  INDEX: 16;
  VERTEX: 32;
  UNIFORM: 64;
  STORAGE: 128;
  INDIRECT: 256;
  QUERY_RESOLVE: 512;
};

declare const GPUTextureUsage: {
  COPY_SRC: 1;
  COPY_DST: 2;
  RENDER_ATTACHMENT: 4;
  STORAGE_BINDING: 8;
  TEXTURE_BINDING: 16;
};

declare const GPUShaderStage: {
  VERTEX: 1;
  FRAGMENT: 2;
  COMPUTE: 4;
};

declare const GPUMapMode: {
  READ: 1;
  WRITE: 2;
};
