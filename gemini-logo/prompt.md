You are an expert WebGL graphics engineer. Build a real-time 3D animated Gemini star logo rendered entirely on the GPU using raymarched signed distance fields (SDFs) in a retro pixel art style. The star rotates, floats, and is accompanied by orbiting sparkle gems — all rendered via a single fullscreen fragment shader. The technology stack is vanilla WebGL (no frameworks, no build tools).


# 1. PROJECT STRUCTURE

Pure static HTML + CSS + JavaScript (ES Modules). No frameworks, no bundlers.

File structure:
- `index.html` — minimal markup: a single `<canvas id="glcanvas">`, links to CSS and JS module
- `css/style.css` — fullscreen dark canvas styling with pixelated image rendering
- `js/shaders.js` — exports `vertexShader` and `fragmentShader` GLSL source strings
- `js/engine.js` — WebGL context setup, shader compilation, uniform handling, render loop


# 2. VISUAL TARGET

The final render is a retro isometric pixel art 3D animation:

- Background: Near-black (#050608) with a subtle deep blue ambient backglow (vec3(0.12, 0.16, 0.28)) centered on screen, fading with distance
- Gemini Star: A 4-pointed astroid shape extruded into 3D with pillowed thickness, colored in Google's brand palette (Blue #4285F4, Red #EA4335, Yellow #FBBC05, Green #34A853), with a radiant white core
- 4 Orbiting Sparkles: Small octahedron gems in each Google color, orbiting the star on the XZ plane and bobbing vertically
- Drop Shadow: A soft shadow projected onto a virtual ground plane below the star, intensity modulated by the floating oscillation
- Pixel Art Aesthetic: The canvas renders at 1/3 native resolution with `image-rendering: pixelated`, Bayer dithering, and 10-level color quantization to simulate 16-bit console graphics
- Cel-shading: Two-tier diffuse thresholds and stepped specular highlights for that satisfying "crunch"
- Black Outline: A math-perfect 1.5px retro outline around all geometries using minimum-distance tracking


# 3. CSS STYLING

- `body, html`: margin 0, padding 0, 100% width/height, background #050608, flex center, overflow hidden, user-select none
- `canvas`: display block, 100% width/height, image-rendering set to pixelated/crisp-edges for all browser prefixes


# 4. VERTEX SHADER

A trivial passthrough for a fullscreen quad:
- `attribute vec2 a_position` maps to `gl_Position = vec4(a_position, 0.0, 1.0)`


# 5. FRAGMENT SHADER — RAYMARCHING ENGINE

`precision highp float` with uniforms `u_time` (float) and `u_resolution` (vec2).

## 5a. Utility Functions

- `mat2 rot(float a)`: 2D rotation matrix from angle
- Global `vec3 mapPos` and `vec3 sparklePos`: trap hit coordinates for material coloring

## 5b. Gemini Star SDF (`sdGemini3D`)

Construct the 4-pointed astroid star via boolean subtraction:
1. Take `abs(p.xy)` for quadrant symmetry
2. Create a flat box: `max(p2.x, p2.y) - 1.05`
3. Subtract 4 cylinders: `length(p2 - vec2(1.25, 1.25)) - sqrt(1.625)` — the radius is computed so tips land at exactly 1.0
4. Star 2D = `max(box2D, -cyl)`
5. Extrude into 3D with tapered thickness: `mix(0.18, 0.03, smoothstep(0.0, 1.0, length(p.xy)))`
6. Apply 0.04 rounded bevel: `min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.04`

## 5c. Scene Map Function

- Float oscillation: `pos.y -= sin(u_time * 2.0) * 0.12`
- Sparkles: Rotate on XZ via `rot(u_time * -0.8)`, 4 octahedrons at positions (±1.5, ±0.4, 0) and (0, ±0.6, ±1.5), each bobbing with `sin(u_time * 3.0 + phase) * 0.15`. Octahedron SDF: `(|x|+|y|+|z|)*0.577 - 0.05`
- Star transforms: Dynamic tilt `rot(sin(u_time*0.8)*0.1)` on XY, primary spin `rot(u_time*1.2)` on XZ, secondary tilt `rot(cos(u_time*0.6)*0.2)` on YZ
- Return `min(dStar, dSparkles)`

## 5d. Normal Computation

Central differences with epsilon 0.005:
```
vec2 e = vec2(0.005, 0.0);
normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)))
```

## 5e. Material Color Function (`getColor`)

First check sparkle proximity (length < 0.15) → return corresponding Google color.

For the star surface:
- Compute `dir = normalize(mapPos.xy)`
- Exponential quadrant weights: `pow(max(0, ±dir.x/y), 2.5)` for Right/Top/Left/Bottom
- Blend Google colors by weights: `(Blue*wR + Red*wT + Yellow*wL + Green*wB) / (wR+wT+wL+wB)`
- White core fade: `mix(vec3(1.0, 0.98, 0.98), col, smoothstep(0.05, 0.55, dist))`

## 5f. Main Rendering

1. **UV Setup**: Floor-snapped pixel coordinates, NDC [-1,1], aspect corrected
2. **Isometric Camera**: Orthographic with scale 2.4, view direction (0,0,-1), rotated by X=-35.264° and Y=-45° (exact isometric angles)
3. **Raymarch**: 90 steps max, surface threshold 0.002, max distance 25.0, track minimum distance for outline
4. **Background**: Base dark + ambient glow + vignette
5. **Drop Shadow**: Ray-plane intersection at y=-2.0, shadow intensity modulated by float offset
6. **Object Shading**: Two-light setup (key at (1, 1.5, 0.8), fill at (-1, -0.5, -0.5)), cel-shaded diffuse with smoothstep thresholds (0.05→0.15 and 0.5→0.6), stepped specular (power 24, step at 0.6), ambient 0.4+0.1*n.y, rim lighting with fresnel, contour deepening at fresnel > 0.85
7. **Outline**: If miss but minHitDist < pixelWidth * 1.5 → dark outline color
8. **Post-processing**: Bayer dithering (2×2 pattern, ±0.15 offset), 10-level color quantization, vignette via smoothstep(1.0, 1.8, length(uv))


# 6. WEBGL ENGINE (`engine.js`)

- Get canvas and WebGL context: `{ antialias: false, alpha: false }`
- Compile and link shaders from imported strings
- Create fullscreen quad buffer: 2 triangles covering [-1,1]
- Uniforms: `u_time` (seconds), `u_resolution` (canvas dimensions)
- Pixel scale factor: `PIXEL_SCALE = 3` — canvas internal resolution = window size / 3
- Render loop via `requestAnimationFrame`: resize canvas if needed, set viewport, update uniforms, draw 6 vertices


# EXACT NUMERICAL CONSTANTS

| Constant | Value |
|----------|-------|
| PIXEL_SCALE | 3 |
| MAX_STEPS | 90 |
| MAX_DIST | 25.0 |
| SURF_DIST | 0.002 |
| Star box size | 1.05 |
| Cylinder center | 1.25 |
| Cylinder radius | sqrt(1.625) |
| Max thickness | 0.18 |
| Min thickness | 0.03 |
| Bevel radius | 0.04 |
| Float amplitude | 0.12 |
| Sparkle orbit radius | 1.5 |
| Sparkle bob amplitude | 0.15 |
| Spin speed (XZ) | 1.2 |
| Camera scale | 2.4 |
| Iso angle X | -35.264° |
| Iso angle Y | -45.0° |
| Specular power | 24 |
| Dither strength | 0.15 |
| Quantize levels | 10 |
| Outline thickness | 1.5px |

Build this as a complete, working static HTML project. The result should be a stunning, self-animating 3D pixel art Gemini star with Google's brand colors, orbiting sparkle gems, cel-shading, and authentic retro pixel aesthetics — all rendered in real-time via GPU raymarching.
