You are an expert Three.js engineer specializing in GPU-accelerated 3D rendering and custom GLSL shader injection. Build a premium 3D voxel pixel art animation of the Claude Asterisk logo. The logo is procedurally generated from an SVG path, extruded into a hollow 3D shell of ~20,000 voxels, and rendered with cinematic lighting, elastic assembly animation, organic idle motion, sweeping energy glow, and Unreal Bloom post-processing. The technology stack is Three.js (via CDN importmap) with vanilla HTML/CSS/JS modules — no build tools required.


# 1. PROJECT STRUCTURE

Pure static HTML + CSS + JavaScript (ES Modules). No frameworks, no bundlers.

File structure:
- `index.html` — minimal markup: preloader div + `<canvas id="webgl-canvas">`, importmap for Three.js CDN, links to CSS and JS module
- `css/style.css` — dark studio background, preloader with 3D flip-bounce spinner, fullscreen canvas
- `js/config.js` — exports CONFIG object (SVG path, colors, voxel parameters, animation constants)
- `js/shaders.js` — exports CUSTOM_GLSL_UTILS string (simplex noise, elastic easing, 3D rotation matrix)
- `js/voxel-generator.js` — exports VoxelMatrixGenerator class (SVG-to-voxel pipeline)
- `js/engine.js` — ClaudePixelEngine class (scene, lights, mesh, post-processing, render loop) + bootstrap

Three.js CDN (importmap):
- `"three"` → `https://unpkg.com/three@0.160.0/build/three.module.js`
- `"three/addons/"` → `https://unpkg.com/three@0.160.0/examples/jsm/`


# 2. VISUAL TARGET

The final render is a cinematic 3D voxel masterpiece:

- Background: Deep warm radial gradient (`radial-gradient(circle at center, #261c18 0%, #080605 100%)`)
- Claude Asterisk: ~20,000 voxel cubes forming the exact Claude logo shape, colored in authentic Claude Orange (#D97757) with volumetric shadow/highlight variation
- Assembly Animation: Voxels scatter from a huge sphere (radius 350-850), then elastically snap into position with chaotic spin
- Idle Motion: Organic simplex noise waving + gentle breathing expansion after assembly
- Energy Sweep: A radial glow band sweeps across the logo surface continuously
- Bloom: UnrealBloomPass creates gorgeous high-end orange glow on highlights
- Cinematic Camera: Slow orbiting rotation, gentle levitation, subtle lateral camera sway
- Preloader: A 3D flip-bouncing orange square pixel spinner, fades out when ready


# 3. CSS STYLING

Global reset with `box-sizing: border-box`. Body: deep studio backdrop `#0d0a09` with warm radial gradient, touch-action none, user-select none.

Canvas: absolute positioned, 100vw × 100vh, z-index 1.

Preloader: absolute fullscreen, background #080605, z-index 9999, flex centered. Pixel spinner: 24×24px, Claude Orange with box-shadow glow, `flip-bounce` keyframe animation (1.5s, perspective 3D rotations with color shift).


# 4. CONFIGURATION (`config.js`)

```js
CONFIG = {
    svgPath: "m19.6 66.5 19.7-11 ...", // Exact Claude asterisk SVG path data (100×100 viewBox)
    colors: {
        base: '#D97757',      // Claude Orange
        shadow: '#632615',    // Volumetric shadow
        highlight: '#FFC8B3', // Edge highlight
        ambient: '#1A1310'    // Fog/background match
    },
    voxel: {
        gridSize: 150,        // Rasterization resolution
        boxSize: 0.84,        // Gap = 1.0 - 0.84 = 0.16 for pixel art aesthetic
        spacing: 1.0,
        depthMultiplier: 1.6  // Z-axis thickness scaling
    },
    anim: {
        flightDuration: 2.5,
        cameraDistance: 190
    }
}
```


# 5. VOXEL GENERATION PIPELINE (`voxel-generator.js`)

## Step 1: SVG Rasterization
- Create offscreen canvas (150×150), fill black
- Center and scale the SVG path to fit 85% of the grid
- Fill path white using `Path2D(svgPath)`

## Step 2: Binary Map Extraction
- Read pixel data, threshold at 128 → `Int32Array` binary grid

## Step 3: Chamfer Distance Transform (SDF)
- Multi-pass Manhattan distance: for each filled pixel, check 4 neighbors (L/R/T/B)
- If all neighbors have equal or greater distance, increment by 1
- Iterate until no updates. Track `maxDepthFound`

## Step 4: 3D Hollow Shell Generation
- Z-depth function: `Math.max(1, floor(distance^0.75 × depthMultiplier))`
- For each filled pixel, extrude ±localDepth layers in Z
- Surface detection: a voxel is surface if it's at the Z-extremes OR if `|z| > min(neighbor depths)`
- This hollow-core optimization reduces ~150,000 voxels to ~20,000

## Step 5: Color Baking & Animation Parameters
- Center all coordinates in 3D space, invert Y
- Edge voxels (dist ≤ 1): lerp base→highlight by 0.3
- Interior voxels: lerp base→shadow by `1 - depthRatio`
- Add ±0.05 lightness micro-variance per voxel
- Cascade animation delay: `radialDist × 0.035 + random × 0.5`
- Random phase offset per voxel


# 6. GLSL SHADER UTILITIES (`shaders.js`)

Three injectable GLSL functions as a template literal string:

1. **3D Simplex Noise** (`snoise(vec3)`): Full permutation-based implementation for organic waving
2. **Elastic Easing** (`easeOutElastic(float)`): `pow(2, -10x) × sin((10x - 0.75) × 2π/3) + 1` for satisfying snap physics
3. **3D Rotation Matrix** (`rotation3d(vec3 axis, float angle)`): Rodrigues' rotation for arbitrary axis spin


# 7. THREE.JS ENGINE (`engine.js`)

## Scene Setup
- PerspectiveCamera: FOV 35, near 1, far 1000, position (0, 0, 190)
- WebGLRenderer: antialias true, alpha true, high-performance, ACES Filmic tone mapping (exposure 1.2), PCF soft shadows
- FogExp2: ambient color, density 0.0035
- World group: all meshes inside a Group for orbital rotation

## Lighting (4 lights)
- AmbientLight: warm #ffebd6, intensity 0.6
- Key DirectionalLight: #ffeedd, intensity 3.0, position (60, 100, 80), shadow map 2048×2048
- Fill DirectionalLight: cool #4a6d8c, intensity 1.5, position (-80, -40, -50)
- Rim DirectionalLight: #ffc2a3, intensity 2.5, position (0, 60, -120)

## Post-Processing
- EffectComposer → RenderPass → UnrealBloomPass (strength 0.8, radius 0.6, threshold 0.85) → OutputPass

## InstancedMesh Construction
- BoxGeometry(0.84³) × ~20,000 instances
- MeshStandardMaterial (roughness 0.3, metalness 0.1)
- 5 InstancedBufferAttributes per voxel: aTarget, aStart, aColor, aParams, aAxis
- Start positions: random spherical scatter (radius 350-850, Z-biased toward camera)
- Spin axes: random normalized vec3

## Shader Injection (material.onBeforeCompile)

### Vertex Shader Modifications:
1. **Assembly**: `mix(aStart, aTarget, easeOutElastic(progress))` where progress = `(uTime - delay) × 0.45`
2. **Spin**: `rotation3d(aAxis, (1-eased) × 20 × speed)` — chaotic spin that decays with assembly
3. **Scale Pop**: `smoothstep(0.0, 0.3, progress)` — grow from nothing
4. **Idle Noise** (after assembly): `snoise(target.xy × 0.03, time × 0.3) × 1.8` Z-displacement + breathing Y-offset
5. **Energy Glow**: `fract(time × 0.2 - radialDist × 0.015)` → sine wave pulse for sweep < 0.15

### Fragment Shader Modifications:
- Override `#include <color_fragment>`: apply vColor + energy glow blend with white core `vec3(1.0, 0.9, 0.8)`
- Multiply by `1 + glow × 2` to exceed 1.0 → triggers Bloom pass

### Depth Material (for shadows):
- Identical vertex position logic injected into MeshDepthMaterial

## Animation Loop
- `uTime` synced to elapsed clock time
- World group Y-rotation: `sin(t × 0.15) × 0.25 + t × 0.12`
- World group X-rotation: `sin(t × 0.2) × 0.15`
- Levitation: Y-position `sin(t × 1.5) × 3.0`
- Camera X-sway: `sin(t × 0.1) × 20`, always lookAt origin
- Render via composer


# EXACT NUMERICAL CONSTANTS

| Constant | Value |
|----------|-------|
| Grid Size | 150 |
| Box Size | 0.84 |
| Depth Multiplier | 1.6 |
| Camera Distance | 190 |
| Camera FOV | 35 |
| Fog Density | 0.0035 |
| Key Light Intensity | 3.0 |
| Fill Light Intensity | 1.5 |
| Rim Light Intensity | 2.5 |
| Bloom Strength | 0.8 |
| Bloom Radius | 0.6 |
| Bloom Threshold | 0.85 |
| Tone Mapping Exposure | 1.2 |
| Material Roughness | 0.3 |
| Material Metalness | 0.1 |
| Assembly Speed | 0.45 |
| Spin Multiplier | 20 |
| Noise Scale | 0.03 |
| Noise Amplitude | 1.8 |
| Glow Sweep Speed | 0.2 |
| Orbit Speed (Y) | 0.12 |
| Levitation Amplitude | 3.0 |
| Scatter Radius | 350–850 |
| Claude Orange | #D97757 |

Build this as a complete, working static HTML project. The result should be a breathtaking, self-animating 3D voxel Claude asterisk logo with elastic assembly physics, organic simplex noise breathing, cinematic bloom, and warm studio lighting — all rendered in real-time via Three.js with custom GPU shader injection.
