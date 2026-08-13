/**
 * webgpuShaders.ts — WGSL Shaders and Matrix Utilities for WebGPU Compositing.
 *
 * Adapted from OpenReel WebGPU pipeline & enhanced for high-performance
 * video layer composition, 4x4 2D/3D transforms, crop clipping, and color grading.
 */

export const compositeShaderSource = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
};

struct LayerUniforms {
  opacity: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> layer: LayerUniforms;
@group(1) @binding(0) var textureSampler: sampler;
@group(1) @binding(1) var layerTexture: texture_2d<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32(i32(vertexIndex & 1u) * 4 - 1);
  let y = f32(i32(vertexIndex >> 1u) * 4 - 1);
  output.position = vec4<f32>(x, y, 0.0, 1.0);
  output.texCoord = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(layerTexture, textureSampler, input.texCoord);
  return vec4<f32>(texColor.rgb, texColor.a * layer.opacity);
}
`;

export const transformShaderSource = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
};

struct TransformUniforms {
  matrix: mat4x4<f32>,
  opacity: f32,
  borderRadius: f32,
  cropX: f32,
  cropY: f32,
  cropWidth: f32,
  cropHeight: f32,
  padding: vec2<f32>,
};

@group(0) @binding(0) var<uniform> transform: TransformUniforms;
@group(1) @binding(0) var textureSampler: sampler;
@group(1) @binding(1) var layerTexture: texture_2d<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  var texCoords = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
  );
  let pos = positions[vertexIndex];
  output.position = transform.matrix * vec4<f32>(pos, 0.0, 1.0);
  output.texCoord = texCoords[vertexIndex];
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let croppedUV = vec2<f32>(
    transform.cropX + input.texCoord.x * transform.cropWidth,
    transform.cropY + input.texCoord.y * transform.cropHeight
  );
  let texColor = textureSample(layerTexture, textureSampler, croppedUV);
  return vec4<f32>(texColor.rgb, texColor.a * transform.opacity);
}
`;

export const colorGradingShaderSource = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
};

struct ColorGradingUniforms {
  exposure: f32,
  contrast: f32,
  saturation: f32,
  temperature: f32,
  tint: f32,
  vignette: f32,
  padding: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: ColorGradingUniforms;
@group(1) @binding(0) var textureSampler: sampler;
@group(1) @binding(1) var inputTexture: texture_2d<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32(i32(vertexIndex & 1u) * 4 - 1);
  let y = f32(i32(vertexIndex >> 1u) * 4 - 1);
  output.position = vec4<f32>(x, y, 0.0, 1.0);
  output.texCoord = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(inputTexture, textureSampler, input.texCoord);

  // Exposure
  color = vec4<f32>(color.rgb * pow(2.0, params.exposure), color.a);

  // Contrast
  color = vec4<f32>((color.rgb - vec3<f32>(0.5)) * params.contrast + vec3<f32>(0.5), color.a);

  // Saturation
  let luma = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  color = vec4<f32>(mix(vec3<f32>(luma), color.rgb, params.saturation), color.a);

  // Vignette
  if (params.vignette > 0.0) {
    let uv = input.texCoord - vec2<f32>(0.5);
    let dist = length(uv);
    let vig = smoothstep(0.7, 0.2, dist * params.vignette);
    color = vec4<f32>(color.rgb * vig, color.a);
  }

  return saturate(color);
}
`;

/**
 * Creates uniform buffer for layer opacity.
 */
export function createLayerUniformsBuffer(opacity: number): Float32Array {
  const buffer = new Float32Array(4);
  buffer[0] = opacity;
  return buffer;
}

/**
 * Creates transform uniform buffer containing 4x4 matrix, opacity, and crop bounds.
 */
export function createTransformUniformsBuffer(
  matrix: Float32Array,
  opacity: number,
  borderRadius = 0,
  crop?: { x: number; y: number; width: number; height: number }
): Float32Array {
  const buffer = new Float32Array(24);
  buffer.set(matrix, 0); // 16 floats
  buffer[16] = opacity;
  buffer[17] = borderRadius;
  buffer[18] = crop?.x ?? 0;
  buffer[19] = crop?.y ?? 0;
  buffer[20] = crop?.width ?? 1;
  buffer[21] = crop?.height ?? 1;
  return buffer;
}

/**
 * Creates a 4x4 transformation matrix mapping normalized layer coords to clip bounds.
 */
export function createTransformMatrix(
  position: { x: number; y: number },
  scale: { x: number; y: number },
  rotation: number,
  canvasWidth: number,
  canvasHeight: number
): Float32Array {
  const matrix = new Float32Array(16);
  const nx = (position.x / canvasWidth) * 2;
  const ny = -(position.y / canvasHeight) * 2; // Inverted Y for WebGPU clip space

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  matrix[0] = scale.x * cos;
  matrix[1] = scale.x * sin;
  matrix[2] = 0;
  matrix[3] = 0;

  matrix[4] = -scale.y * sin;
  matrix[5] = scale.y * cos;
  matrix[6] = 0;
  matrix[7] = 0;

  matrix[8] = 0;
  matrix[9] = 0;
  matrix[10] = 1;
  matrix[11] = 0;

  matrix[12] = nx;
  matrix[13] = ny;
  matrix[14] = 0;
  matrix[15] = 1;

  return matrix;
}
