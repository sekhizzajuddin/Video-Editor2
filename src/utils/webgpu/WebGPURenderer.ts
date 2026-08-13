/**
 * WebGPURenderer.ts — Hardware-Accelerated WebGPU Preview Compositor Engine.
 *
 * Provides real-time GPU-driven video composition, texture sampling,
 * hardware matrix transforms, and WGSL shader passes for the Preview Canvas.
 * Adapted from OpenReel WebGPU architecture & integrated with ProCut store state.
 */

import { getWebGPUDevice } from './webgpuDevice';
import {
  compositeShaderSource,
  transformShaderSource,
  createTransformMatrix,
  createTransformUniformsBuffer,
  createLayerUniformsBuffer,
} from './webgpuShaders';

export interface WebGPULayerSource {
  id: string;
  element: HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
  width: number;
  height: number;
  opacity: number;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  crop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export class WebGPURenderEngine {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  private initialized = false;

  private compositePipeline: GPURenderPipeline | null = null;
  private transformPipeline: GPURenderPipeline | null = null;
  private textureSampler: GPUSampler | null = null;

  private bindGroupLayoutUniform: GPUBindGroupLayout | null = null;
  private bindGroupLayoutTexture: GPUBindGroupLayout | null = null;

  private textureCache = new Map<string, GPUTexture>();

  /**
   * Initializes the WebGPU engine for the given HTMLCanvasElement target.
   */
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    const gpuState = await getWebGPUDevice();
    if (!gpuState.supported || !gpuState.device) {
      return false;
    }

    this.device = gpuState.device;
    this.format = gpuState.format;

    this.context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!this.context) {
      console.warn('[WebGPU] Failed to acquire webgpu context from canvas.');
      return false;
    }

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.setupPipelines();
    this.initialized = true;
    return true;
  }

  public isReady(): boolean {
    return this.initialized && !!this.device && !!this.context;
  }

  private setupPipelines(): void {
    if (!this.device) return;

    // Linear Texture Sampler
    this.textureSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Bind Group Layouts
    this.bindGroupLayoutUniform = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.bindGroupLayoutTexture = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayoutUniform, this.bindGroupLayoutTexture],
    });

    // Composite Pipeline
    const compositeModule = this.device.createShaderModule({
      code: compositeShaderSource,
    });
    this.compositePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: compositeModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: compositeModule,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

    // Transform Pipeline
    const transformModule = this.device.createShaderModule({
      code: transformShaderSource,
    });
    this.transformPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: transformModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: transformModule,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /**
   * Uploads an HTML element (Video/Image/Canvas) to a GPUTexture.
   */
  private uploadTexture(layer: WebGPULayerSource): GPUTexture | null {
    if (!this.device) return null;
    const { element, width, height } = layer;

    if (element instanceof HTMLVideoElement && (element.readyState < 2 || element.videoWidth === 0 || element.videoHeight === 0)) {
      return null;
    }

    try {
      const texture = this.device.createTexture({
        size: [Math.max(1, width), Math.max(1, height), 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.device.queue.copyExternalImageToTexture(
        { source: element },
        { texture },
        [Math.max(1, width), Math.max(1, height)]
      );

      return texture;
    } catch (err) {
      console.warn(`[WebGPU] Failed to copy external texture for ${layer.id}:`, err);
      return null;
    }
  }

  /**
   * Renders stacked video layers onto the WebGPU canvas context.
   */
  renderFrame(layers: WebGPULayerSource[], canvasWidth: number, canvasHeight: number): boolean {
    if (!this.isReady() || !this.device || !this.context) {
      return false;
    }

    let currentTexture: GPUTexture;
    try {
      currentTexture = this.context.getCurrentTexture();
    } catch (e) {
      return false;
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: 'WebGPU Preview Compositor Encoder',
    });

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    for (const layer of layers) {
      const texture = this.uploadTexture(layer);
      if (!texture) continue;

      const matrix = createTransformMatrix(
        layer.transform,
        { x: layer.transform.scale / 100, y: layer.transform.scale / 100 },
        (layer.transform.rotation * Math.PI) / 180,
        canvasWidth,
        canvasHeight
      );

      const cropUV = layer.crop
        ? {
            x: layer.crop.left / 100,
            y: layer.crop.top / 100,
            width: (100 - layer.crop.left - layer.crop.right) / 100,
            height: (100 - layer.crop.top - layer.crop.bottom) / 100,
          }
        : undefined;

      const uniformData = createTransformUniformsBuffer(matrix, layer.opacity, 0, cropUV);

      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      const bindGroupUniform = this.device.createBindGroup({
        layout: this.bindGroupLayoutUniform!,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      const bindGroupTexture = this.device.createBindGroup({
        layout: this.bindGroupLayoutTexture!,
        entries: [
          { binding: 0, resource: this.textureSampler! },
          { binding: 1, resource: texture.createView() },
        ],
      });

      renderPass.setPipeline(this.transformPipeline!);
      renderPass.setBindGroup(0, bindGroupUniform);
      renderPass.setBindGroup(1, bindGroupTexture);
      renderPass.draw(6, 1, 0, 0);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
    return true;
  }

  destroy(): void {
    this.textureCache.forEach((t) => t.destroy());
    this.textureCache.clear();
    this.initialized = false;
    this.device = null;
    this.context = null;
  }
}
