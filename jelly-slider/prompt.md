You are an expert WebGPU graphics engineer. Build a real-time interactive 3D jelly slider UI component rendered entirely on the GPU using raymarched signed distance fields (SDFs). The slider is a translucent, physically-simulated jelly bar that the user can drag horizontally. The entire scene — ground plane, slider geometry, lighting, shadows, reflections, refraction — is rendered via a single fullscreen fragment shader using sphere-tracing (raymarching). The technology stack is TypeGPU with Vite + unplugin-typegpu.


# 1. PROJECT SETUP

Create a Vite project with the following dependencies:
- `typegpu@^0.10.0` — TypeScript-first WebGPU abstraction
- `@typegpu/sdf@^0.10.0` — SDF primitive library (boxes, spheres, beziers, planes, pies, extrusions, smooth unions)
- `@typegpu/noise@^0.10.0` — GPU noise functions (`randf`)
- `wgpu-matrix@^3.3.0` — Matrix math library
- `unplugin-typegpu@^0.10.0` (devDependency) — Build plugin that processes `'use gpu'` directives

The `vite.config.js` must use `unplugin-typegpu/vite` as a plugin. All GPU shader functions use the `'use gpu'` directive inside their arrow function bodies. CRITICAL: Inside `'use gpu'` functions, each `let`/`const` statement must declare exactly ONE variable (the `tinyest-for-wgsl` transpiler does not support `let a=1, b=2;`).

The HTML file is minimal: just a fullscreen `<canvas id="webgpu-canvas">` and Google Fonts preconnect for JetBrains Mono (400) and Reddit Mono (400).


# 2. SCENE DESCRIPTION & VISUAL TARGET

The final render looks like a premium neumorphic UI mockup in 3D:

- Background: Soft off-white/light gray (#f2f2f2) environment
- Ground plane: A flat white surface with a rounded rectangular cutout/channel where the slider sits. The channel has subtle rounded edges (roundness: 0.02, thickness: 0.03). The ground extends as an infinite plane (`sdPlane` at y=0.06) combined with an extruded rounded box cutout
- Slider: A translucent amber/orange jelly bar (color: `vec3f(1.0, 0.45, 0.075)`) sitting inside the channel. It is defined by a 2D polyline of 17 control points that are physics-simulated, then extruded into 3D with rounded edges (half-thickness: 0.17, edge radius: 0.024)
- End cap: The right end of the slider terminates in a rounded pie-shaped 3D cap that rotates based on the last two control points
- Percentage text: Rendered on the ground surface next to the slider end, showing "0%" to "100%" using a pre-rendered 2D canvas text atlas (101 layers, one per percentage). Font: 180px Reddit Mono for numbers, 140px JetBrains Mono for the "%" symbol. The text is darkened against the ground color
- Lighting: A single directional light at direction `normalize(vec3f(0.19, -0.24, 0.75))`, white color. The scene has ambient lighting (color: `vec3f(0.6)`, intensity: 0.6), specular highlights (power: 10, intensity: 0.6), and ambient occlusion
- Shadows: Fake projected shadows on the ground — the slider shape is projected along the light direction onto the ground surface using the bezier SDF texture. The shadow is colored by the jelly color (orange tint in lit areas). Caustic-like highlights appear on the ground beneath the jelly
- The slider casts an orange bounce light onto nearby ground surfaces, with intensity falling off by `1/(sqDist*15+1)`


# 3. PHYSICS SIMULATION (CPU-SIDE)

The slider is a Position-Based Dynamics (PBD) simulation of a 1D chain:

- 17 points connected by distance constraints
- Start anchor at `vec2f(-1, 0)`, end point dragged by mouse input
- The first and last points are pinned (inverse mass = 0), all others have mass = 1
- Substeps: 6 per frame
- Iterations: 16 constraint projection passes per substep
- Damping: 0.01
- Constraints:
  1. Distance constraints between adjacent points (rest length = totalLength / (n-1)), stiffness k=0.1
  2. Bending constraints between points i-1 and i+1 (rest length = 2 * restLen). Bending strength varies by position: stronger at edges (exponent 1.2), base strength 0.1
  3. End flattening: The first and last `endFlatCount=1` interior points are projected toward `baseY` with stiffness 0.05
  4. Arch force: When the slider is compressed (endpoint closer to anchor), an upward arch force is applied using `sin(π*t)` profile with smoothstep edge windowing and `archStrength=2`
- Control points: Computed as the intersection of tangent lines at adjacent points (for smooth Bézier interpolation). When normals are nearly parallel (dot > 0.99) or at endpoints, the midpoint is used instead
- Normals: Computed from finite differences along the chain (central differences for interior points, forward/backward for endpoints)

After each physics step, the GPU buffers (points, control points, normals) are written, and a compute pipeline renders the 2D SDF of the slider into a `256×128` `rgba16float` texture. Each pixel stores: `(distance, overallProgress, normalX, normalY)`. The distance is computed using `sdBezier` from the `@typegpu/sdf` package across all chain segments.


# 4. MOUSE / TOUCH INTERACTION

- Mouse and touch input on the canvas
- Horizontal dragging controls the slider endpoint
- Input is clamped to `[0.45, 0.9]` of canvas width (normalized), then mapped to target range `[-0.7, 1.0]` with offset -0.5
- Smoothing factor: 0.08 (exponential moving average)
- On first interaction, the attribution overlay fades out (opacity transition 0.5s)


# 5. CAMERA SYSTEM

- Position: `vec3f(0.024, 2.7, 1.9)`, looking at origin, up = `vec3f(0, 1, 0)`
- FOV: π/4 (45°), near: 0.1, far: 10
- Temporal Anti-Aliasing jitter: Each frame applies a sub-pixel offset using a Halton sequence (base 2 for X, base 3 for Y). The jitter is applied as a translation in the projection matrix: `((haltonValue - 0.5) * 2.0) / dimension`
- Camera provides view, projection, inverse view, and inverse projection matrices as a GPU uniform struct


# 6. RAYMARCHING PIPELINE (GPU)

The full rendering is a single fullscreen fragment shader (`common.fullScreenTriangle` for vertex stage):

# 6a. Ray Generation
- Convert fragment UV to NDC `[-1, 1]`
- Unproject through inverse projection and inverse view matrices to get world-space ray origin and direction

# 6b. Scene SDF
The scene has two object types:
1. BACKGROUND (ground plane + channel cutout): `opUnion(sdPlane(...), opExtrudeY(..., -rectangleCutoutDist(...), thickness) - roundness)`
2. SLIDER (jelly bar): Look up the pre-computed bezier SDF texture, extrude in Z (half-thickness 0.17) minus edge radius 0.024. For `t > 0.94` (near endpoint), use the 3D pie cap SDF instead

A bounding box acceleration is used: first test ray-AABB intersection against the slider bounding box before marching the slider SDF. If the ray misses the AABB, only march the background.

# 6c. Marching Parameters
- MAX_STEPS: 64
- MAX_DIST: 10
- SURF_DIST: 0.001 (surface threshold)

# 6d. Normal Computation
- Uses the tetrahedron technique (4-sample SDF gradient): sample at `k.xyy, k.yyx, k.yxy, k.xxx` offsets where `k = vec3f(1, -1, 0)`
- A `tgpu.slot()` mechanism is used to swap the SDF function (cap SDF vs main scene SDF) for different normal computations
- Slider normals blend between the 2D gradient from the bezier SDF texture and the Z-axis direction using smoothstep, with end cap normals blended in for `t > 0.94`

# 6e. Lighting Model
For background surfaces:
- Diffuse: `max(dot(N, L), 0)` × light color × base color (0.9, 0.9, 0.9)
- Specular: Phong reflection, power=10, intensity=0.6
- Ambient: `vec3f(0.6) × 0.6`
- Ambient Occlusion: 3-step marching along normal (radius 0.1, intensity 0.5, bias = SURF_DIST × 5). Weight halves each step
- Fake shadows: Project slider shape onto ground via light direction, sample bezier SDF texture
- Bounce light: Orange color from jelly, falloff `1/(sqDist×15+1)` and side bounce `1/(sqDist×40+1)` weighted by `abs(normal.z)`

For jelly surfaces:
- Fresnel-Schlick: `r0 + (1 - r0) × (1 - cosθ)^5` with IOR = 1.42
- Refraction: Snell's law refraction, march into the jelly, exit, then march the background scene from exit point
- Beer-Lambert absorption: `exp(-absorb × progress²)` where `absorb = (1 - jellyColor) × 20` — this gives the orange tint varying by thickness
- Subsurface scattering: Forward scattering tint `jellyColor × 1.5 × scatterStrength(3) × forward × progress³`
- Final color: `reflection × F + refraction × (1 - F)`
- Tone mapping: Final pixel color is `tanh(color × 1.3)` for soft HDR compression


# 7. TEMPORAL ANTI-ALIASING (TAA)

- Compute shader with workgroup size `[16, 16]`
- Each frame: current render + previous resolved frame
- Neighborhood clamping: Sample 3×3 neighborhood of current frame, clamp history color to `[min, max]` of neighbors
- Adaptive blend factor: 0.9 default, reduced to 0.7 in the text region (UV range: x=[0.71, 0.85], y=[0.47, 0.55]) with smoothstep border (0.02)
- Double-buffered: alternating between two `rgba8unorm` textures for history
- Final output sampled with a linear filtering sampler


# 8. PERCENTAGE TEXT ATLAS

- Pre-render 101 text images (0% to 100%) into a 2D texture array
- Each layer: 512×256 pixels (`rgba8unorm`)
- Rendering: Canvas 2D — right-aligned text, white on transparent
  - Number: 180px "Reddit Mono" at `(width - 20, height/2)`
  - "%": 140px "JetBrains Mono" at `(width - 20, height/2 + 10)`
- Wait for `document.fonts.ready` before rendering
- Percentage displayed = `(endCapX + 0.43) × 84`, clamped to `[0, 100]` as unsigned integer index
- Text is rendered as a darkened overlay on the ground: `textColor = saturate(backgroundColor × 0.5)`


# 9. ADAPTIVE QUALITY

On startup, auto-detect optimal resolution scale:
- Requires `timestamp-query` GPU feature
- Start at scale 0.3, target frame time 5ms, tolerance 2ms
- 8 profiling iterations: render to test texture, measure GPU time, adjust ±0.1
- Clamp to `[0.3, 1.0]`
- On resize: recreate all textures, reset TAA history, update camera projection


# 10. RENDERING LOOP

Each frame:
1. Apply camera jitter (Halton TAA)
2. Update random uniform (for noise seeding)
3. Update slider physics
4. Render fullscreen raymarching to offscreen texture
5. TAA resolve (current + history → resolved)
6. Blit resolved texture to canvas via a separate render pipeline
7. `requestAnimationFrame` loop


# EXACT NUMERICAL CONSTANTS

| Constant | Value |
|----------|-------|
| MAX_STEPS | 64 |
| MAX_DIST | 10 |
| SURF_DIST | 0.001 |
| GROUND_ALBEDO | vec3f(1.0) |
| AMBIENT_COLOR | vec3f(0.6) |
| AMBIENT_INTENSITY | 0.6 |
| SPECULAR_POWER | 10 |
| SPECULAR_INTENSITY | 0.6 |
| JELLY_IOR | 1.42 |
| JELLY_SCATTER_STRENGTH | 3 |
| AO_STEPS | 3 |
| AO_RADIUS | 0.1 |
| AO_INTENSITY | 0.5 |
| LINE_RADIUS (edge round) | 0.024 |
| LINE_HALF_THICK (Z extrusion) | 0.17 |
| NUM_POINTS (chain) | 17 |
| BEZIER_TEXTURE_SIZE | 256 × 128 |
| Ground thickness | 0.03 |
| Ground roundness | 0.02 |
| Jelly color | vec4f(1.0, 0.45, 0.075, 1.0) |
| Light direction | normalize(0.19, -0.24, 0.75) |
| Camera position | (0.024, 2.7, 1.9) |
| Camera FOV | π/4 |

Build this as a complete, working Vite + TypeGPU project. The result should be a beautiful, interactive 3D jelly slider that responds to mouse/touch dragging with physically simulated wobble, translucent refraction, colored shadows, and temporal anti-aliasing. Every frame is entirely GPU-rendered via raymarching — no triangle meshes are used except the fullscreen triangle.
