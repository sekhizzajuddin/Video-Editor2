/**
 * webgpuDevice.ts — WebGPU Hardware Acceleration Device Manager.
 *
 * Checks browser WebGPU availability, requests GPU adapters and devices,
 * handles device loss recovery, and configures preferred canvas formats.
 */

export interface WebGPUDeviceState {
  supported: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  format: GPUTextureFormat;
  error?: string;
}

let cachedState: WebGPUDeviceState | null = null;
let initPromise: Promise<WebGPUDeviceState> | null = null;

/**
 * Checks if WebGPU is supported by the current browser environment.
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
}

/**
 * Gets or initializes the singleton GPUDevice instance.
 */
export async function getWebGPUDevice(): Promise<WebGPUDeviceState> {
  if (cachedState && cachedState.device && !cachedState.device.lost) {
    return cachedState;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async (): Promise<WebGPUDeviceState> => {
    if (!isWebGPUSupported()) {
      cachedState = {
        supported: false,
        adapter: null,
        device: null,
        format: 'bgra8unorm' as any,
        error: 'WebGPU is not supported by this browser.',
      } as WebGPUDeviceState;
      return cachedState;
    }

    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        cachedState = {
          supported: false,
          adapter: null,
          device: null,
          format: 'bgra8unorm' as any,
          error: 'No suitable WebGPU adapter found.',
        } as WebGPUDeviceState;
        return cachedState;
      }

      const device = await adapter.requestDevice({
        requiredFeatures: [],
      });

      const format = (navigator as any).gpu.getPreferredCanvasFormat();

      device.lost.then((info: any) => {
        console.warn(`[WebGPU] GPUDevice lost (${info.reason}): ${info.message}`);
        cachedState = null;
        initPromise = null;
      });

      cachedState = {
        supported: true,
        adapter,
        device,
        format: format as any,
      } as WebGPUDeviceState;
      return cachedState;
    } catch (err: any) {
      console.warn('[WebGPU] Failed to initialize GPUDevice:', err);
      cachedState = {
        supported: false,
        adapter: null,
        device: null,
        format: 'bgra8unorm' as any,
        error: err.message || 'WebGPU initialization failed.',
      } as WebGPUDeviceState;
      return cachedState;
    }
  })();

  return initPromise;
}
