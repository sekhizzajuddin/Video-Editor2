/**
 * WebGPUObjectRemoval.ts — Hardware-Accelerated Object Removal & Inpainting Engine
 * 
 * High-performance GPU-driven object removal using WebGPU compute shaders.
 * Supports: Content-Aware Fill, Patch Match, Gaussian Blur, Mosaic Pixelate
 * 
 * Architecture:
 * - Compute shader for parallel pixel processing
 * - Multi-pass pipeline: Mask → Sample → Blend → Feather
 * - Temporal coherence with motion vector caching
 * - Fallback to Canvas2D for non-WebGPU browsers
 * 
 * Performance targets: 60 FPS @ 4K with GPU acceleration
 */

import type { ClipObjectRemovalSettings } from '@/types';
import { getWebGPUDevice } from './webgpuDevice';

// ─────────────────────────────────────────────────────────────────────────────
// WGSL Compute Shader for Object Removal
// ─────────────────────────────────────────────────────────────────────────────

const objectRemovalShaderSource = /* wgsl */ `
struct ObjectRemovalUniforms {
  centerX: f32,
  centerY: f32,
  width: f32,
  height: f32,
  rotation: f32,
  feather: f32,
  opacity: f32,
  mode: f32,           // 0=content_aware, 1=patch_replace, 2=blur, 3=pixelate
  stretchStrength: f32,
  patchSourceX: f32,
  patchSourceY: f32,
  shape: f32,          // 0=rectangle, 1=ellipse
  canvasWidth: f32,
  canvasHeight: f32,
  targetR: f32,        // Normalized 0..1 target watermark R
  targetG: f32,        // Normalized 0..1 target watermark G
  targetB: f32,        // Normalized 0..1 target watermark B
  colorTolerance: f32, // 0 = full_box, >0 = selective watermark tolerance
  alphaUnblend: f32,   // 1 = reverse alpha unblending enabled
  isAutoSmart: f32,    // 1 = auto/brand multi-signature detection
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: ObjectRemovalUniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var textureSampler: sampler;

// Calculate mask coverage weight with smooth cubic Hermite feathering
fn getMaskBlendWeight(uv: vec2<f32>) -> f32 {
  let cx = params.centerX / params.canvasWidth;
  let cy = params.centerY / params.canvasHeight;
  let halfW = (params.width / params.canvasWidth) * 0.5;
  let halfH = (params.height / params.canvasHeight) * 0.5;

  let cosRot = cos(params.rotation);
  let sinRot = sin(params.rotation);
  let dx = uv.x - cx;
  let dy = uv.y - cy;
  let rx = dx * cosRot - dy * sinRot;
  let ry = dx * sinRot + dy * cosRot;

  if (params.shape > 0.5) { // Ellipse
    let nx = rx / max(0.0001, halfW);
    let ny = ry / max(0.0001, halfH);
    let r = length(vec2<f32>(nx, ny));
    if (r >= 1.0) {
      return 0.0;
    }
    let fNorm = max(0.01, params.feather / min(params.width, params.height));
    if (r <= (1.0 - fNorm)) {
      return 1.0;
    }
    let t = (1.0 - r) / fNorm;
    return t * t * (3.0 - 2.0 * t);
  } else { // Rectangle
    let ax = abs(rx);
    let ay = abs(ry);
    if (ax >= halfW || ay >= halfH) {
      return 0.0;
    }
    let edgeDistX = (halfW - ax) * params.canvasWidth;
    let edgeDistY = (halfH - ay) * params.canvasHeight;
    let edgeDist = min(edgeDistX, edgeDistY);
    if (params.feather <= 0.5) {
      return 1.0;
    }
    let t = clamp(edgeDist / params.feather, 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }
}

// Multi-Directional Texture Synthesis + Boundary Coons Reference + Reverse Alpha Unblending
// GPU-parallelizable approximation of PatchMatch: samples surrounding texture from 8 directions,
// mirrors it inward, and weights by color continuity with Coons boundary estimate.
fn sampleTextureInfill(uv: vec2<f32>, obsColor: vec4<f32>) -> vec4<f32> {
  let cx = params.centerX / params.canvasWidth;
  let cy = params.centerY / params.canvasHeight;
  let halfW = (params.width / params.canvasWidth) * 0.5;
  let halfH = (params.height / params.canvasHeight) * 0.5;

  let cosRot = cos(params.rotation);
  let sinRot = sin(params.rotation);
  let dx = uv.x - cx;
  let dy = uv.y - cy;
  let rx = dx * cosRot - dy * sinRot;
  let ry = dx * sinRot + dy * cosRot;

  let u = clamp((rx + halfW) / max(0.0001, 2.0 * halfW), 0.0, 1.0);
  let v = clamp((ry + halfH) / max(0.0001, 2.0 * halfH), 0.0, 1.0);

  // Border ring offset just outside the watermark box
  let padX = (params.feather * 0.5 + 3.0) / params.canvasWidth;
  let padY = (params.feather * 0.5 + 3.0) / params.canvasHeight;

  // ── Coons Boundary Surface (kept as reference for watermark mask detection) ──
  let topLocal = vec2<f32>(rx, -halfH - padY);
  let botLocal = vec2<f32>(rx, halfH + padY);
  let leftLocal = vec2<f32>(-halfW - padX, ry);
  let rightLocal = vec2<f32>(halfW + padX, ry);

  let uvTop = clamp(vec2<f32>(cx + topLocal.x * cosRot + topLocal.y * sinRot, cy - topLocal.x * sinRot + topLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));
  let uvBot = clamp(vec2<f32>(cx + botLocal.x * cosRot + botLocal.y * sinRot, cy - botLocal.x * sinRot + botLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));
  let uvLeft = clamp(vec2<f32>(cx + leftLocal.x * cosRot + leftLocal.y * sinRot, cy - leftLocal.x * sinRot + leftLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));
  let uvRight = clamp(vec2<f32>(cx + rightLocal.x * cosRot + rightLocal.y * sinRot, cy - rightLocal.x * sinRot + rightLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));

  let tlLocal = vec2<f32>(-halfW - padX, -halfH - padY);
  let trLocal = vec2<f32>(halfW + padX, -halfH - padY);
  let blLocal = vec2<f32>(-halfW - padX, halfH + padY);
  let brLocal = vec2<f32>(halfW + padX, halfH + padY);

  let uvTL = clamp(vec2<f32>(cx + tlLocal.x * cosRot + tlLocal.y * sinRot, cy - tlLocal.x * sinRot + tlLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));
  let uvTR = clamp(vec2<f32>(cx + trLocal.x * cosRot + trLocal.y * sinRot, cy - trLocal.x * sinRot + trLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));
  let uvBL = clamp(vec2<f32>(cx + blLocal.x * cosRot + blLocal.y * sinRot, cy - blLocal.x * sinRot + blLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));
  let uvBR = clamp(vec2<f32>(cx + brLocal.x * cosRot + brLocal.y * sinRot, cy - brLocal.x * sinRot + brLocal.y * cosRot), vec2<f32>(0.0), vec2<f32>(1.0));

  let sT = textureSample(inputTexture, textureSampler, uvTop);
  let sB = textureSample(inputTexture, textureSampler, uvBot);
  let sL = textureSample(inputTexture, textureSampler, uvLeft);
  let sR = textureSample(inputTexture, textureSampler, uvRight);

  let CTL = textureSample(inputTexture, textureSampler, uvTL);
  let CTR = textureSample(inputTexture, textureSampler, uvTR);
  let CBL = textureSample(inputTexture, textureSampler, uvBL);
  let CBR = textureSample(inputTexture, textureSampler, uvBR);

  let Su = u * u * (3.0 - 2.0 * u);
  let Sv = v * v * (3.0 - 2.0 * v);

  let loftY = (1.0 - Sv) * sT + Sv * sB;
  let loftX = (1.0 - Su) * sL + Su * sR;
  let loftXY = (1.0 - Su) * (1.0 - Sv) * CTL + Su * (1.0 - Sv) * CTR + (1.0 - Su) * Sv * CBL + Su * Sv * CBR;
  var macroBG = clamp(loftY + loftX - loftXY, vec4<f32>(0.0), vec4<f32>(1.0));

  // ── Multi-Directional Texture Synthesis ──
  // Sample texture from 8 directions outside the box, mirror inward, weight by color continuity
  // This is a GPU-parallelizable approximation of PatchMatch NNF texture synthesis

  // 8 directional rays in local rotated box space (N, NE, E, SE, S, SW, W, NW)
  let dir0 = vec2<f32>( 0.0, -1.0);  // N
  let dir1 = vec2<f32>( 0.707, -0.707); // NE
  let dir2 = vec2<f32>( 1.0,  0.0);  // E
  let dir3 = vec2<f32>( 0.707,  0.707); // SE
  let dir4 = vec2<f32>( 0.0,  1.0);  // S
  let dir5 = vec2<f32>(-0.707,  0.707); // SW
  let dir6 = vec2<f32>(-1.0,  0.0);  // W
  let dir7 = vec2<f32>(-0.707, -0.707); // NW

  // Accumulate best 4 directional texture samples weighted by color continuity
  var bestW = array<f32, 4>(0.0, 0.0, 0.0, 0.0);
  var bestC = array<vec3<f32>, 4>(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));

  // Process each direction: find boundary intersection, sample mirrored texture, compute weight
  let dirs = array<vec2<f32>, 8>(dir0, dir1, dir2, dir3, dir4, dir5, dir6, dir7);

  for (var i = 0u; i < 8u; i++) {
    let d = dirs[i];

    // Ray-box intersection: find distance to box edge along direction d from pixel (rx, ry)
    var tBound = 1e6;
    if (abs(d.x) > 0.001) {
      let tR = (halfW - rx) / d.x;
      let tL = (-halfW - rx) / d.x;
      let tX = select(tL, tR, d.x > 0.0);
      if (tX > 0.0) { tBound = min(tBound, tX); }
    }
    if (abs(d.y) > 0.001) {
      let tB = (halfH - ry) / d.y;
      let tT = (-halfH - ry) / d.y;
      let tY = select(tT, tB, d.y > 0.0);
      if (tY > 0.0) { tBound = min(tBound, tY); }
    }
    if (tBound > 1e5) { continue; }

    // Edge position where the ray exits the box (in local rotated space)
    let edgeLocal = vec2<f32>(
      clamp(rx + d.x * tBound, -halfW, halfW),
      clamp(ry + d.y * tBound, -halfH, halfH)
    );

    // Sample border color just outside the box along this direction
    let borderLocal = edgeLocal + d * vec2<f32>(padX, padY);
    let borderUV = clamp(vec2<f32>(
      cx + borderLocal.x * cosRot + borderLocal.y * sinRot,
      cy - borderLocal.x * sinRot + borderLocal.y * cosRot
    ), vec2<f32>(0.0), vec2<f32>(1.0));
    let borderCol = textureSample(inputTexture, textureSampler, borderUV);

    // Coons prediction at this edge point for color continuity check
    let ub = clamp((edgeLocal.x + halfW) / max(0.0001, 2.0 * halfW), 0.0, 1.0);
    let vb = clamp((edgeLocal.y + halfH) / max(0.0001, 2.0 * halfH), 0.0, 1.0);
    let Sub = ub * ub * (3.0 - 2.0 * ub);
    let Svb = vb * vb * (3.0 - 2.0 * vb);
    let coonsPred = clamp(
      (1.0 - Svb) * sT + Svb * sB + (1.0 - Sub) * sL + Sub * sR
      - ((1.0 - Sub) * (1.0 - Svb) * CTL + Sub * (1.0 - Svb) * CTR + (1.0 - Sub) * Svb * CBL + Sub * Svb * CBR),
      vec4<f32>(0.0), vec4<f32>(1.0)
    );

    // Color continuity: how well does the border color match the Coons prediction?
    let colDiff = distance(borderCol.rgb, coonsPred.rgb);

    // Mirror texture from outside box: sample at the reflected position across the boundary
    let mirrorDist = tBound + padX * 2.0; // How far to sample outside
    let mirrorLocal = edgeLocal + d * vec2<f32>(padX * 2.5, padY * 2.5);
    let mirrorUV = clamp(vec2<f32>(
      cx + mirrorLocal.x * cosRot + mirrorLocal.y * sinRot,
      cy - mirrorLocal.x * sinRot + mirrorLocal.y * cosRot
    ), vec2<f32>(0.0), vec2<f32>(1.0));
    let texSample = textureSample(inputTexture, textureSampler, mirrorUV);

    // Adjust sampled texture toward Coons prediction for color consistency
    let candidate = mix(texSample.rgb, coonsPred.rgb, 0.25);

    // Direction weight: prefer directions with low color difference (better continuity)
    // and directions closer to the pixel (shorter boundary distance)
    let continuityW = exp(-colDiff * colDiff * 25.0);
    let proximityW = 1.0 / (1.0 + tBound * 3.0);
    let dirWeight = continuityW * proximityW;

    // Insert into sorted top-4 list
    if (dirWeight > bestW[3]) {
      if (dirWeight > bestW[0]) {
        bestW[3] = bestW[2]; bestC[3] = bestC[2];
        bestW[2] = bestW[1]; bestC[2] = bestC[1];
        bestW[1] = bestW[0]; bestC[1] = bestC[0];
        bestW[0] = dirWeight; bestC[0] = candidate;
      } else if (dirWeight > bestW[1]) {
        bestW[3] = bestW[2]; bestC[3] = bestC[2];
        bestW[2] = bestW[1]; bestC[2] = bestC[1];
        bestW[1] = dirWeight; bestC[1] = candidate;
      } else if (dirWeight > bestW[2]) {
        bestW[3] = bestW[2]; bestC[3] = bestC[2];
        bestW[2] = dirWeight; bestC[2] = candidate;
      } else {
        bestW[3] = dirWeight; bestC[3] = candidate;
      }
    }
  }

  // Blend best directional samples weighted by their continuity scores
  let totalW = bestW[0] + bestW[1] + bestW[2] + bestW[3];
  var synthColor = macroBG.rgb; // Fallback to Coons if no direction found
  if (totalW > 0.001) {
    synthColor = (bestC[0] * bestW[0] + bestC[1] * bestW[1] + bestC[2] * bestW[2] + bestC[3] * bestW[3]) / totalW;
  }

  // Add coherent camera sensor noise grain
  let grainSeed = uv * vec2<f32>(params.canvasWidth, params.canvasHeight);
  let n = fract(sin(dot(grainSeed, vec2<f32>(12.9898, 78.233))) * 43758.5453);
  let grain = (n - 0.5) * 0.024 * params.stretchStrength;
  let filledBG = clamp(synthColor + vec3<f32>(grain), vec3<f32>(0.0), vec3<f32>(1.0));

  // If full_box mode (colorTolerance <= 0.001), return full synthesized infill
  if (params.colorTolerance <= 0.001) {
    return vec4<f32>(filledBG, 1.0);
  }

  // ── Selective Watermark Pixel Detection & Reverse Alpha Unblending ──
  let bgDiff = distance(obsColor.rgb, macroBG.rgb);
  let minBgDev = max(0.03, (1.0 - params.colorTolerance) * 0.14);

  // If pixel is already indistinguishable from surrounding background (clean pixel between letters), preserve it!
  if (bgDiff < minBgDev) {
    return vec4<f32>(obsColor.rgb, 0.0);
  }

  var wmColor = vec3<f32>(params.targetR, params.targetG, params.targetB);
  if (params.isAutoSmart > 0.5) {
    let obsLum = dot(obsColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let bgLum = dot(macroBG.rgb, vec3<f32>(0.299, 0.587, 0.114));
    if (obsLum >= bgLum + 0.02) {
      wmColor = vec3<f32>(1.0, 1.0, 1.0); // Semi-transparent white
    } else if (obsLum < bgLum - 0.05) {
      wmColor = vec3<f32>(0.06, 0.06, 0.06); // Dark drop shadow / stroke
    }
  }

  let vecBGtoWM = wmColor - macroBG.rgb;
  let vecBGtoObs = obsColor.rgb - macroBG.rgb;
  let lenWM2 = dot(vecBGtoWM, vecBGtoWM);
  var estAlpha = clamp(bgDiff / 0.55, 0.15, 0.92);
  if (lenWM2 > 0.01) {
    let proj = dot(vecBGtoObs, vecBGtoWM) / lenWM2;
    if (proj > 0.04) {
      estAlpha = clamp(proj, 0.06, 0.95);
    }
  }

  var finalRGB = filledBG;
  if (params.alphaUnblend > 0.5 && estAlpha >= 0.05 && estAlpha <= 0.85) {
    let invOneMinusA = 1.0 / max(0.14, 1.0 - estAlpha);
    let unblended = clamp((obsColor.rgb - estAlpha * wmColor) * invOneMinusA, vec3<f32>(0.0), vec3<f32>(1.0));
    let unblendTrust = max(0.0, min(1.0, (0.85 - estAlpha) / 0.55));
    finalRGB = mix(filledBG, unblended, unblendTrust * 0.72);
  }

  let maskConfidence = clamp((bgDiff - minBgDev) / max(0.02, minBgDev * 1.5), 0.0, 1.0);
  return vec4<f32>(finalRGB, maskConfidence);
}

// Backward compatibility alias for applyBlur which calls sampleHarmonicInfill
fn sampleHarmonicInfill(uv: vec2<f32>, obsColor: vec4<f32>) -> vec4<f32> {
  return sampleTextureInfill(uv, obsColor);
}

// Color-calibrated patch replace (clone stamp)
fn samplePatch(uv: vec2<f32>) -> vec4<f32> {
  let cx = params.centerX / params.canvasWidth;
  let cy = params.centerY / params.canvasHeight;
  let srcX = params.patchSourceX / params.canvasWidth;
  let srcY = params.patchSourceY / params.canvasHeight;

  let offset = uv - vec2<f32>(cx, cy);
  let patchUV = clamp(vec2<f32>(srcX, srcY) + offset, vec2<f32>(0.0), vec2<f32>(1.0));

  let srcSample = textureSample(inputTexture, textureSampler, patchUV);

  // Boundary lighting comparison (Poisson approximation)
  let halfH = (params.height / params.canvasHeight) * 0.5;
  let tgtBorder = textureSample(inputTexture, textureSampler, clamp(vec2<f32>(cx, cy + halfH + 0.01), vec2<f32>(0.0), vec2<f32>(1.0)));
  let srcBorder = textureSample(inputTexture, textureSampler, clamp(vec2<f32>(srcX, srcY + halfH + 0.01), vec2<f32>(0.0), vec2<f32>(1.0)));
  let delta = tgtBorder - srcBorder;

  return vec4<f32>(clamp((srcSample + delta * 0.85).rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// Blur with watermark text neutralization
fn applyBlur(uv: vec2<f32>, obsColor: vec4<f32>) -> vec4<f32> {
  let blurAmount = max(0.005, (params.width / params.canvasWidth) * 0.03);
  var color: vec4<f32> = vec4<f32>(0.0);
  var weight: f32 = 0.0;

  // Center harmonic estimate to pull high-contrast white text glyphs
  let harmonic = sampleHarmonicInfill(uv, obsColor);

  for (var x = -3; x <= 3; x++) {
    for (var y = -3; y <= 3; y++) {
      let offset = vec2<f32>(f32(x), f32(y)) * blurAmount;
      let sampleUV = clamp(uv + offset, vec2<f32>(0.0), vec2<f32>(1.0));
      var samp = textureSample(inputTexture, textureSampler, sampleUV);

      // Contrast spike suppression
      let diff = abs(dot(samp.rgb, vec3<f32>(0.299, 0.587, 0.114)) - dot(harmonic.rgb, vec3<f32>(0.299, 0.587, 0.114)));
      if (diff > 0.08) {
        samp = mix(samp, vec4<f32>(harmonic.rgb, 1.0), 0.8);
      }

      let w = exp(-dot(offset, offset) / max(0.00001, blurAmount * blurAmount));
      color += samp * w;
      weight += w;
    }
  }

  if (weight > 0.0) {
    color /= weight;
  }
  return vec4<f32>(color.rgb, 1.0);
}

// Mosaic pixelate
fn applyPixelate(uv: vec2<f32>) -> vec4<f32> {
  let pixelSize = max(0.005, (params.width / params.canvasWidth) * 0.06);
  let quantizedUV = floor(uv / pixelSize) * pixelSize + pixelSize * 0.5;
  let s = textureSample(inputTexture, textureSampler, clamp(quantizedUV, vec2<f32>(0.0), vec2<f32>(1.0)));
  return vec4<f32>(s.rgb, 1.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let width = u32(params.canvasWidth);
  let height = u32(params.canvasHeight);

  if (global_id.x >= width || global_id.y >= height) {
    return;
  }

  let uv = vec2<f32>(
    f32(global_id.x) / f32(width),
    f32(global_id.y) / f32(height) // Standard top-down canvas coordinates
  );

  var color = textureLoad(inputTexture, global_id.xy, 0);

  let blendWeight = getMaskBlendWeight(uv);
  if (blendWeight <= 0.001) {
    textureStore(outputTexture, global_id.xy, color);
    return;
  }

  var processedColor: vec4<f32>;
  if (params.mode < 0.5) { // Content-aware Texture Synthesis + Selective Unblending
    processedColor = sampleTextureInfill(uv, color);
  } else if (params.mode < 1.5) { // Patch replace
    processedColor = samplePatch(uv);
  } else if (params.mode < 2.5) { // Blur
    processedColor = applyBlur(uv, color);
  } else { // Pixelate
    processedColor = applyPixelate(uv);
  }

  let finalAlpha = blendWeight * params.opacity * processedColor.a;
  let blendedColor = vec4<f32>(mix(color.rgb, processedColor.rgb, finalAlpha), color.a);

  textureStore(outputTexture, global_id.xy, blendedColor);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// WebGPU Object Removal Engine Class
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectRemovalUniforms {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  feather: number;
  opacity: number;
  mode: number;
  stretchStrength: number;
  patchSourceX: number;
  patchSourceY: number;
  shape: number;
  canvasWidth: number;
  canvasHeight: number;
  targetR: number;
  targetG: number;
  targetB: number;
  colorTolerance: number;
  alphaUnblend: number;
  isAutoSmart: number;
}

export class WebGPUObjectRemovalEngine {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private initialized = false;
  
  private textureCache = new Map<string, GPUTexture>();
  private uniformBuffer: GPUBuffer | null = null;
  
  /**
   * Initialize WebGPU object removal engine
   */
  async initialize(): Promise<boolean> {
    const gpuState = await getWebGPUDevice();
    if (!gpuState.supported || !gpuState.device) {
      console.warn('[WebGPU Object Removal] WebGPU not available, will fallback to Canvas2D');
      return false;
    }
    
    this.device = gpuState.device;
    
    try {
      // Create bind group layout
      this.bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            texture: { sampleType: 'float' },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: { access: 'write-only', format: 'rgba8unorm' },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            sampler: { type: 'filtering' },
          },
        ],
      });
      
      // Create pipeline layout
      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      });
      
      // Create compute pipeline
      const shaderModule = this.device.createShaderModule({
        code: objectRemovalShaderSource,
      });
      
      this.pipeline = this.device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });
      
      // Create sampler
      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
      
      this.initialized = true;
      return true;
    } catch (err) {
      console.error('[WebGPU Object Removal] Initialization failed:', err);
      return false;
    }
  }
  
  /**
   * Create or reuse GPU texture from canvas/video source
   */
  private createInputTexture(
    source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    width: number,
    height: number
  ): GPUTexture | null {
    if (!this.device) return null;
    
    try {
      const texture = this.device.createTexture({
        size: [width, height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      
      this.device.queue.copyExternalImageToTexture(
        { source },
        { texture },
        [width, height]
      );
      
      return texture;
    } catch (err) {
      console.warn('[WebGPU Object Removal] Failed to create input texture:', err);
      return null;
    }
  }
  
  /**
   * Create output texture for processed result
   */
  private createOutputTexture(width: number, height: number): GPUTexture | null {
    if (!this.device) return null;
    
    const key = `output_${width}x${height}`;
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key)!;
    }
    
    const texture = this.device!.createTexture({
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    
    this.textureCache.set(key, texture);
    return texture;
  }
  
  /**
   * Update uniform buffer with current settings
   */
  private updateUniforms(settings: ObjectRemovalUniforms): void {
    if (!this.device || !this.uniformBuffer) return;
    
    const uniformData = new Float32Array([
      settings.centerX,
      settings.centerY,
      settings.width,
      settings.height,
      settings.rotation,
      settings.feather,
      settings.opacity,
      settings.mode,
      settings.stretchStrength,
      settings.patchSourceX,
      settings.patchSourceY,
      settings.shape,
      settings.canvasWidth,
      settings.canvasHeight,
      settings.targetR,
      settings.targetG,
      settings.targetB,
      settings.colorTolerance,
      settings.alphaUnblend,
      settings.isAutoSmart,
      0, 0, // padding (22 floats total = 88 bytes, buffer is 96 bytes)
    ]);
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }
  
  /**
   * Execute object removal on GPU
   */
  async processFrame(
    source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    settings: ClipObjectRemovalSettings,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<HTMLCanvasElement | null> {
    if (!this.initialized || !this.device || !this.pipeline || !this.sampler) {
      return null;
    }

    // Parse target Hex color
    const hex = (settings.targetColor || '#FFFFFF').replace('#', '');
    const targetR = (parseInt(hex.substring(0, 2), 16) || 255) / 255;
    const targetG = (parseInt(hex.substring(2, 4), 16) || 255) / 255;
    const targetB = (parseInt(hex.substring(4, 6), 16) || 255) / 255;
    const profileId = settings.watermarkProfile || 'auto_smart';
    const isFullBox = profileId === 'full_box';
    const isAutoSmart = profileId !== 'custom_color' && profileId !== 'semi_white' && !isFullBox ? 1 : 0;
    
    // Convert percentage settings to pixels
    const uniforms: ObjectRemovalUniforms = {
      centerX: (settings.x / 100) * canvasWidth,
      centerY: (settings.y / 100) * canvasHeight,
      width: (settings.width / 100) * canvasWidth,
      height: (settings.height / 100) * canvasHeight,
      rotation: (settings.rotation * Math.PI) / 180,
      feather: Math.min(settings.feather, Math.min(canvasWidth, canvasHeight) * 0.25),
      opacity: (settings.opacity ?? 100) / 100,
      mode: settings.mode === 'content_aware' ? 0 : settings.mode === 'patch_replace' ? 1 : settings.mode === 'blur_conceal' ? 2 : 3,
      stretchStrength: (settings.stretchStrength ?? 80) / 100,
      patchSourceX: (settings.patchSourceX ?? 30) / 100 * canvasWidth,
      patchSourceY: (settings.patchSourceY ?? 30) / 100 * canvasHeight,
      shape: settings.shape === 'ellipse' ? 1 : 0,
      canvasWidth,
      canvasHeight,
      targetR: profileId === 'dark_logo' ? 0.08 : targetR,
      targetG: profileId === 'dark_logo' ? 0.08 : targetG,
      targetB: profileId === 'dark_logo' ? 0.08 : targetB,
      colorTolerance: isFullBox ? 0 : (settings.colorTolerance ?? 38) / 100,
      alphaUnblend: settings.alphaUnblend !== false ? 1 : 0,
      isAutoSmart,
    };
    
    // Create input texture
    const inputTexture = this.createInputTexture(source, canvasWidth, canvasHeight);
    if (!inputTexture) return null;
    
    // Create output texture
    const outputTexture = this.createOutputTexture(canvasWidth, canvasHeight);
    if (!outputTexture) return null;
    
    // Create or update uniform buffer
    if (!this.uniformBuffer || this.uniformBuffer.size < 96) {
      this.uniformBuffer?.destroy();
      this.uniformBuffer = this.device.createBuffer({
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    
    this.updateUniforms(uniforms);
    
    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: inputTexture.createView() },
        { binding: 2, resource: outputTexture.createView() },
        { binding: 3, resource: this.sampler },
      ],
    });
    
    // Encode compute commands
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline!);
    passEncoder.setBindGroup(0, bindGroup);
    
    const workgroupCountX = Math.ceil(canvasWidth / 16);
    const workgroupCountY = Math.ceil(canvasHeight / 16);
    passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    passEncoder.end();
    
    // Create read buffer for pixel data (aligned to 256 bytes per row for WebGPU spec compliance)
    const alignedBytesPerRow = Math.ceil((canvasWidth * 4) / 256) * 256;
    const readBufferSize = alignedBytesPerRow * canvasHeight;
    const readBuffer = this.device.createBuffer({
      size: readBufferSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    
    // Copy texture to buffer
    commandEncoder.copyTextureToBuffer(
      { texture: outputTexture },
      { buffer: readBuffer, bytesPerRow: alignedBytesPerRow, rowsPerImage: canvasHeight },
      { width: canvasWidth, height: canvasHeight }
    );
    
    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);
    
    // Read buffer and draw to canvas
    await readBuffer.mapAsync(GPUMapMode.READ);
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = canvasWidth;
    resultCanvas.height = canvasHeight;
    const resultCtx = resultCanvas.getContext('2d')!;
    
    const imageData = resultCtx.createImageData(canvasWidth, canvasHeight);
    const mapped = new Uint8ClampedArray(readBuffer.getMappedRange());
    const outData = imageData.data;
    const unpaddedRowBytes = canvasWidth * 4;

    for (let y = 0; y < canvasHeight; y++) {
      const srcOffset = y * alignedBytesPerRow;
      const dstOffset = y * unpaddedRowBytes;
      outData.set(mapped.subarray(srcOffset, srcOffset + unpaddedRowBytes), dstOffset);
    }

    readBuffer.unmap();
    resultCtx.putImageData(imageData, 0, 0);
    
    // Cleanup
    inputTexture.destroy();
    readBuffer.destroy();
    
    return resultCanvas;
  }
  
  /**
   * Check if WebGPU object removal is available
   */
  isAvailable(): boolean {
    return this.initialized && !!this.device && !!this.pipeline;
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.textureCache.forEach((texture) => texture.destroy());
    this.textureCache.clear();
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.initialized = false;
    this.device = null;
  }
}

// Singleton instance
let webgpuObjectRemovalInstance: WebGPUObjectRemovalEngine | null = null;

export function getWebGPUObjectRemovalEngine(): WebGPUObjectRemovalEngine {
  if (!webgpuObjectRemovalInstance) {
    webgpuObjectRemovalInstance = new WebGPUObjectRemovalEngine();
  }
  return webgpuObjectRemovalInstance;
}
