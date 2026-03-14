import * as sdf from '@typegpu/sdf';
import tgpu from 'typegpu';
import * as common from 'typegpu/common';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import { randf } from '@typegpu/noise';
import * as m from 'wgpu-matrix';

// Safety check for WebGPU support
if (!navigator.gpu) {
    document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#333;background:#f2f2f2;font-family:sans-serif;font-size:24px;text-align:center;padding:2rem;">WebGPU is not supported in your browser.<br><br>Please use Chrome, Edge, or a compatible browser with WebGPU enabled.</div>';
    throw new Error('WebGPU not supported');
}

// ==========================================
// 1. Constants
// ==========================================
const MAX_STEPS = 64;
const MAX_DIST = 10;
const SURF_DIST = 0.001;
const GROUND_ALBEDO = d.vec3f(1);
const AMBIENT_COLOR = d.vec3f(0.6);
const AMBIENT_INTENSITY = 0.6;
const SPECULAR_POWER = 10;
const SPECULAR_INTENSITY = 0.6;
const JELLY_IOR = 1.42;
const JELLY_SCATTER_STRENGTH = 3;
const AO_STEPS = 3;
const AO_RADIUS = 0.1;
const AO_INTENSITY = 0.5;
const AO_BIAS = SURF_DIST * 5;
const LINE_RADIUS = 0.024;
const LINE_HALF_THICK = 0.17;
const MOUSE_SMOOTHING = 0.08;
const MOUSE_MIN_X = 0.45;
const MOUSE_MAX_X = 0.9;
const MOUSE_RANGE_MIN = 0.4;
const MOUSE_RANGE_MAX = 0.9;
const TARGET_MIN = -0.7;
const TARGET_MAX = 1.0;
const TARGET_OFFSET = -0.5;

// ==========================================
// 2. Data Types & Layouts
// ==========================================
const DirectionalLight = d.struct({ direction: d.vec3f, color: d.vec3f });
const ObjectType = { SLIDER: 1, BACKGROUND: 2 };
const HitInfo = d.struct({ distance: d.f32, objectType: d.i32, t: d.f32 });
const LineInfo = d.struct({ t: d.f32, distance: d.f32, normal: d.vec2f });
const BoxIntersection = d.struct({ hit: d.bool, tMin: d.f32, tMax: d.f32 });
const Ray = d.struct({ origin: d.vec3f, direction: d.vec3f });
const SdfBbox = d.struct({ left: d.f32, right: d.f32, bottom: d.f32, top: d.f32 });

const rayMarchLayout = tgpu.bindGroupLayout({ backgroundTexture: { texture: d.texture2d(d.f32) } });
const taaResolveLayout = tgpu.bindGroupLayout({
    currentTexture: { texture: d.texture2d() },
    historyTexture: { texture: d.texture2d() },
    outputTexture: { storageTexture: d.textureStorage2d('rgba8unorm', 'write-only') },
});
const sampleLayout = tgpu.bindGroupLayout({ currentTexture: { texture: d.texture2d() } });

// ==========================================
// 3. Shader Math Utils
// ==========================================
const fresnelSchlick = tgpu.fn([d.f32, d.f32, d.f32], d.f32)((cosTheta, ior1, ior2) => {
    'use gpu';
    const r0 = std.pow((ior1 - ior2) / (ior1 + ior2), 2.0);
    return r0 + (1.0 - r0) * std.pow(1.0 - cosTheta, 5.0);
});

const beerLambert = tgpu.fn([d.vec3f, d.f32], d.vec3f)((sigma, dist) => {
    'use gpu';
    return std.exp(std.mul(sigma, -dist));
});

const intersectBox = tgpu.fn([d.vec3f, d.vec3f, d.vec3f, d.vec3f], BoxIntersection)((rayOrigin, rayDirection, boxMin, boxMax) => {
    'use gpu';
    const invDir = d.vec3f(1.0).div(rayDirection);
    const t1 = std.sub(boxMin, rayOrigin).mul(invDir);
    const t2 = std.sub(boxMax, rayOrigin).mul(invDir);
    const tMinVec = std.min(t1, t2);
    const tMaxVec = std.max(t1, t2);
    const tMin = std.max(std.max(tMinVec.x, tMinVec.y), tMinVec.z);
    const tMax = std.min(std.min(tMaxVec.x, tMaxVec.y), tMaxVec.z);

    const result = BoxIntersection();
    result.hit = tMax >= tMin && tMax >= 0.0;
    result.tMin = tMin;
    result.tMax = tMax;
    return result;
});

function createTextures(root, width, height) {
    return [0, 1].map(() => {
        const texture = root['~unstable']
            .createTexture({ size: [width, height], format: 'rgba8unorm' })
            .$usage('storage', 'sampled', 'render');
        return { write: texture.createView(d.textureStorage2d('rgba8unorm')), sampled: texture.createView() };
    });
}

function createBackgroundTexture(root, width, height) {
    const texture = root['~unstable']
        .createTexture({ size: [width, height], format: 'rgba16float' })
        .$usage('sampled', 'render');
    return { sampled: texture.createView() };
}

// ==========================================
// 4. Input Interactions
// ==========================================
class EventHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 1.0;
        this.targetMouseX = 1.0;
        this.isMouseDown = false;

        this.canvas.addEventListener('mouseup', () => { this.isMouseDown = false; });
        this.canvas.addEventListener('mouseleave', () => { this.isMouseDown = false; });
        this.canvas.addEventListener('mousedown', (e) => { this.handlePointerDown(e.clientX); });
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isMouseDown) this.handlePointerMove(e.clientX);
        });

        // Mobile Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            this.handlePointerDown(e.touches[0].clientX);
        }, { passive: true });
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.isMouseDown) this.handlePointerMove(e.touches[0].clientX);
        }, { passive: true });
        this.canvas.addEventListener('touchend', () => {
            this.isMouseDown = false;
        });
    }
    handlePointerDown(clientX) {
        this.isMouseDown = true;
        this.updateTargetMouseX(clientX);
    }
    handlePointerMove(clientX) {
        this.updateTargetMouseX(clientX);
    }
    updateTargetMouseX(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        const normalizedX = (clientX - rect.left) / rect.width;
        const clampedX = Math.max(MOUSE_MIN_X, Math.min(MOUSE_MAX_X, normalizedX));
        this.targetMouseX = ((clampedX - MOUSE_RANGE_MIN) / (MOUSE_RANGE_MAX - MOUSE_RANGE_MIN)) * (TARGET_MAX - TARGET_MIN) + TARGET_OFFSET;
    }
    update() {
        if (this.isMouseDown) {
            this.mouseX += (this.targetMouseX - this.mouseX) * MOUSE_SMOOTHING;
        }
    }
    get currentMouseX() { return this.mouseX; }
}

// ==========================================
// 5. Percentage Text Generation (Canvas 2D Atlas)
// ==========================================
const PERCENTAGE_WIDTH = 256 * 2;
const PERCENTAGE_HEIGHT = 128 * 2;
const PERCENTAGE_COUNT = 101;

class NumberProvider {
    constructor(root) {
        this.digitTextureAtlas = root['~unstable']
            .createTexture({ size: [PERCENTAGE_WIDTH, PERCENTAGE_HEIGHT, PERCENTAGE_COUNT], format: 'rgba8unorm' })
            .$usage('sampled', 'render');
    }
    async fillAtlas() {
        await document.fonts.ready;
        const canvas = document.createElement('canvas');
        canvas.width = PERCENTAGE_WIDTH;
        canvas.height = PERCENTAGE_HEIGHT;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';

        const percentageImages = [];
        for (let i = 0; i <= 100; i++) {
            ctx.clearRect(0, 0, PERCENTAGE_WIDTH, PERCENTAGE_HEIGHT);
            const x = PERCENTAGE_WIDTH - 20;
            const y = PERCENTAGE_HEIGHT / 2;
            ctx.font = '180px "Reddit Mono", monospace';
            ctx.fillText(`${i} `, x, y);
            ctx.font = '140px "JetBrains Mono", monospace';
            ctx.fillText(`%`, x, y + 10);
            percentageImages.push(await createImageBitmap(canvas));
        }
        this.digitTextureAtlas.write(percentageImages);
    }
}

// ==========================================
// 6. Camera Controller
// ==========================================
const CameraStruct = d.struct({ view: d.mat4x4f, proj: d.mat4x4f, viewInv: d.mat4x4f, projInv: d.mat4x4f });
function halton(index, base) {
    let result = 0, f = 1 / base, i = index;
    while (i > 0) { result += f * (i % base); i = Math.floor(i / base); f = f / base; }
    return result;
}
function* haltonSequence(base) {
    let index = 1;
    while (true) { yield halton(index, base); index++; }
}

class CameraController {
    #uniform; #view; #proj; #viewInv; #projInv; #baseProj; #baseProjInv; #haltonX; #haltonY; #width; #height;
    constructor(root, position, target, up, fov, width, height, near = 0.1, far = 10) {
        this.#width = width;
        this.#height = height;
        this.#view = m.mat4.lookAt(position, target, up, new Float32Array(16));
        this.#baseProj = m.mat4.perspective(fov, width / height, near, far, new Float32Array(16));
        this.#proj = this.#baseProj;
        this.#viewInv = m.mat4.invert(this.#view, new Float32Array(16));
        this.#baseProjInv = m.mat4.invert(this.#baseProj, new Float32Array(16));
        this.#projInv = this.#baseProjInv;
        this.#uniform = root.createUniform(CameraStruct, {
            view: this.#view, proj: this.#proj, viewInv: this.#viewInv, projInv: this.#projInv,
        });
        this.#haltonX = haltonSequence(2);
        this.#haltonY = haltonSequence(3);
    }
    jitter() {
        const jx = this.#haltonX.next().value;
        const jy = this.#haltonY.next().value;
        const jitterMatrix = m.mat4.identity(new Float32Array(16));
        jitterMatrix[12] = ((jx - 0.5) * 2.0) / this.#width;
        jitterMatrix[13] = ((jy - 0.5) * 2.0) / this.#height;
        const jitteredProj = m.mat4.mul(jitterMatrix, this.#baseProj, new Float32Array(16));
        this.#uniform.writePartial({ proj: jitteredProj, projInv: m.mat4.invert(jitteredProj, new Float32Array(16)) });
    }
    updateProjection(fov, width, height, near = 0.1, far = 100) {
        this.#width = width;
        this.#height = height;
        this.#baseProj = m.mat4.perspective(fov, width / height, near, far, new Float32Array(16));
        this.#baseProjInv = m.mat4.invert(this.#baseProj, new Float32Array(16));
        this.#uniform.writePartial({ proj: this.#baseProj, projInv: this.#baseProjInv });
    }
    get cameraUniform() { return this.#uniform; }
}

// ==========================================
// 7. Slider Physics & Generation
// ==========================================
const BEZIER_TEXTURE_SIZE = [256, 128];
class Slider {
    #root; #pos; #normals; #prev; #invMass; #targetX; #controlPoints; #yOffset; #computeBezierPipeline;
    constructor(root, start, end, numPoints, yOffset = 0) {
        this.#root = root;
        this.n = Math.max(2, numPoints | 0);
        this.anchor = start;
        this.baseY = start.y;
        this.#targetX = end.x;
        this.#yOffset = yOffset;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        this.totalLength = Math.hypot(dx, dy);
        this.restLen = this.totalLength / (this.n - 1);

        this.#pos = Array.from({ length: this.n });
        this.#controlPoints = Array.from({ length: this.n - 1 });
        this.#normals = Array.from({ length: this.n });
        this.#prev = Array.from({ length: this.n });
        this.#invMass = new Float32Array(this.n);

        for (let i = 0; i < this.n; i++) {
            const t = i / (this.n - 1);
            const x = start.x * (1 - t) + end.x * t;
            const y = start.y * (1 - t) + end.y * t + this.#yOffset;
            this.#pos[i] = d.vec2f(x, y);
            this.#prev[i] = d.vec2f(x, y);
            this.#normals[i] = d.vec2f(0, 1);
            this.#invMass[i] = i === 0 || i === this.n - 1 ? 0 : 1;
            if (i < this.n - 1) {
                const t2 = (i + 0.5) / (this.n - 1);
                this.#controlPoints[i] = d.vec2f(start.x * (1 - t2) + end.x * t2, start.y * (1 - t2) + end.y * t2 + this.#yOffset);
            }
        }

        this.pointsBuffer = this.#root.createBuffer(d.arrayOf(d.vec2f, this.n), this.#pos).$usage('storage');
        this.controlPointsBuffer = this.#root.createBuffer(d.arrayOf(d.vec2f, this.n - 1), this.#controlPoints).$usage('storage');
        this.normalsBuffer = this.#root.createBuffer(d.arrayOf(d.vec2f, this.n), this.#normals).$usage('storage');
        this.bezierTexture = this.#root['~unstable'].createTexture({ size: BEZIER_TEXTURE_SIZE, format: 'rgba16float' }).$usage('sampled', 'storage', 'render');
        this.endCapUniform = this.#root.createUniform(d.vec4f, d.vec4f(0, 0, 0, 0));

        const bezierWriteView = this.bezierTexture.createView(d.textureStorage2d('rgba16float', 'write-only'));
        const pointsView = this.pointsBuffer.as('readonly');
        const controlPointsView = this.controlPointsBuffer.as('readonly');

        const padding = 0.01;
        const left = start.x - this.totalLength * padding;
        const right = end.x + this.totalLength * padding * 10;
        const bottom = -0.3;
        const top = 0.65;
        this.bbox = [top, right, bottom, left];

        this.iterations = 16;
        this.substeps = 6;
        this.damping = 0.01;
        this.bendingStrength = 0.1;
        this.archStrength = 2;
        this.endFlatCount = 1;
        this.endFlatStiffness = 0.05;
        this.bendingExponent = 1.2;
        this.archEdgeDeadzone = 0.01;

        this.#computeBezierPipeline = this.#root.createGuardedComputePipeline((x, y) => {
            'use gpu';
            const size = std.textureDimensions(bezierWriteView.$);
            const pixelUV = d.vec2f(x, y).add(0.5).div(d.vec2f(size));
            const sliderPos = d.vec2f(left + pixelUV.x * (right - left), top - pixelUV.y * (top - bottom));

            let minDist = d.f32(1e10);
            let closestSegment = d.i32(0);
            let closestT = d.f32(0);

            const epsilon = d.f32(0.03);
            const xOffset = d.vec2f(epsilon, 0.0);
            const yOffset = d.vec2f(0.0, epsilon);

            let xPlusDist = d.f32(1e10);
            let xMinusDist = d.f32(1e10);
            let yPlusDist = d.f32(1e10);
            let yMinusDist = d.f32(1e10);

            for (let i = 0; i < pointsView.$.length - 1; i++) {
                const A = pointsView.$[i];
                const B = pointsView.$[i + 1];
                const C = controlPointsView.$[i];

                const dist = sdf.sdBezier(sliderPos, A, C, B);
                if (dist < minDist) {
                    minDist = dist;
                    closestSegment = i;
                    const AB = B.sub(A);
                    const AP = sliderPos.sub(A);
                    const ABLength = std.length(AB);
                    if (ABLength > 0.0) {
                        closestT = std.clamp(std.dot(AP, AB) / (ABLength * ABLength), 0.0, 1.0);
                    } else {
                        closestT = 0.0;
                    }
                }
                xPlusDist = std.min(xPlusDist, sdf.sdBezier(sliderPos.add(xOffset), A, C, B));
                xMinusDist = std.min(xMinusDist, sdf.sdBezier(sliderPos.sub(xOffset), A, C, B));
                yPlusDist = std.min(yPlusDist, sdf.sdBezier(sliderPos.add(yOffset), A, C, B));
                yMinusDist = std.min(yMinusDist, sdf.sdBezier(sliderPos.sub(yOffset), A, C, B));
            }
            const overallProgress = (d.f32(closestSegment) + closestT) / d.f32(pointsView.$.length - 1);
            const normalX = (xPlusDist - xMinusDist) / (2.0 * epsilon);
            const normalY = (yPlusDist - yMinusDist) / (2.0 * epsilon);

            std.textureStore(bezierWriteView.$, d.vec2u(x, y), d.vec4f(minDist, overallProgress, normalX, normalY));
        });
    }

    setDragX(x) {
        const minX = this.anchor.x - this.totalLength;
        const maxX = this.anchor.x + this.totalLength;
        this.#targetX = Math.max(minX, Math.min(maxX, x));
    }

    update(dt) {
        if (dt <= 0) return;
        const h = dt / this.substeps;
        const damp = Math.max(0, Math.min(0.999, this.damping));
        const compression = Math.max(0, 1 - Math.abs(this.#targetX - this.anchor.x) / this.totalLength);

        for (let s = 0; s < this.substeps; s++) {
            this.#integrate(h, damp, compression);
            this.#projectConstraints();
        }

        this.#computeNormals();
        this.#computeControlPoints();
        this.#updateGPUBuffer();
        this.#computeBezierPipeline.dispatchThreads(...BEZIER_TEXTURE_SIZE);
    }

    #integrate(h, damp, compression) {
        for (let i = 0; i < this.n; i++) {
            const px = this.#pos[i].x; const py = this.#pos[i].y;
            if (i === 0) {
                this.#pos[i] = d.vec2f(this.anchor.x, this.anchor.y + this.#yOffset);
                this.#prev[i] = d.vec2f(this.anchor.x, this.anchor.y + this.#yOffset);
                continue;
            }
            if (i === this.n - 1) {
                this.#pos[i] = d.vec2f(this.#targetX, 0.08 + this.#yOffset);
                this.#prev[i] = d.vec2f(this.#targetX, 0.08 + this.#yOffset);
                continue;
            }

            const vx = (px - this.#prev[i].x) * (1 - damp);
            const vy = (py - this.#prev[i].y) * (1 - damp);

            let ay = 0;
            if (compression > 0) {
                const t = i / (this.n - 1);
                const edge = this.archEdgeDeadzone;

                const smStep = (e0, e1, v) => {
                    const x = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
                    return x * x * (3 - 2 * x);
                };

                const window = smStep(edge, 1 - edge, t) * smStep(edge, 1 - edge, 1 - t);
                const profile = Math.sin(Math.PI * t) * window;
                ay = this.archStrength * profile * compression;
            }

            this.#prev[i] = d.vec2f(px, py);
            this.#pos[i] = d.vec2f(px + vx, py + vy + ay * h * h);

            if (this.#pos[i].y < this.baseY + this.#yOffset) {
                this.#pos[i] = d.vec2f(this.#pos[i].x, this.baseY + this.#yOffset);
            }
        }
    }

    #projectConstraints() {
        for (let it = 0; it < this.iterations; it++) {
            for (let i = 0; i < this.n - 1; i++) this.#projectDistance(i, i + 1, this.restLen, 0.1);

            for (let i = 1; i < this.n - 1; i++) {
                const t = i / (this.n - 1);
                const distFromCenter = Math.abs(t - 0.5) * 2;
                const strength = distFromCenter ** this.bendingExponent;
                const k = this.bendingStrength * (0.05 + 0.95 * strength);
                this.#projectDistance(i - 1, i + 1, 2 * this.restLen, k);
            }

            if (this.endFlatCount > 0) {
                const count = Math.min(this.endFlatCount, this.n - 2);
                for (let i = 1; i <= count; i++) this.#projectLineY(i, this.baseY + this.#yOffset, this.endFlatStiffness);
                for (let i = this.n - 1 - count; i < this.n - 1; i++) this.#projectLineY(i, this.baseY + this.#yOffset, this.endFlatStiffness);
            }

            this.#pos[0] = d.vec2f(this.anchor.x, this.anchor.y + this.#yOffset);
            this.#pos[this.n - 1] = d.vec2f(this.#targetX, 0.08 + this.#yOffset);
        }
    }

    #projectDistance(i, j, rest, k) {
        const dx = this.#pos[j].x - this.#pos[i].x;
        const dy = this.#pos[j].y - this.#pos[i].y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-8) return;

        const w1 = this.#invMass[i], w2 = this.#invMass[j];
        const wsum = w1 + w2;
        if (wsum <= 0) return;

        const diff = (len - rest) / len;
        const c1 = (w1 / wsum) * k, c2 = (w2 / wsum) * k;

        this.#pos[i] = d.vec2f(this.#pos[i].x + dx * diff * c1, this.#pos[i].y + dy * diff * c1);
        this.#pos[j] = d.vec2f(this.#pos[j].x - dx * diff * c2, this.#pos[j].y - dy * diff * c2);
    }

    #projectLineY(i, yTarget, k) {
        if (i <= 0 || i >= this.n - 1 || this.#invMass[i] <= 0) return;
        this.#pos[i] = d.vec2f(this.#pos[i].x, this.#pos[i].y + (yTarget - this.#pos[i].y) * Math.max(0, Math.min(1, k)));
    }

    #computeNormals() {
        const n = this.n, eps = 1e-6;
        for (let i = 0; i < n; i++) {
            let dx, dy;
            if (i === 0 && n > 1) { dx = this.#pos[1].x - this.#pos[0].x; dy = this.#pos[1].y - this.#pos[0].y; }
            else if (i === n - 1 && n > 1) { dx = this.#pos[n - 1].x - this.#pos[n - 2].x; dy = this.#pos[n - 1].y - this.#pos[n - 2].y; }
            else { dx = this.#pos[i + 1].x - this.#pos[i - 1].x; dy = this.#pos[i + 1].y - this.#pos[i - 1].y; }

            let len = Math.hypot(dx, dy);
            if (len < eps) {
                if (i > 0) { dx = this.#pos[i].x - this.#pos[i - 1].x; dy = this.#pos[i].y - this.#pos[i - 1].y; len = Math.hypot(dx, dy); }
                if (len < eps && i < n - 1) { dx = this.#pos[i + 1].x - this.#pos[i].x; dy = this.#pos[i + 1].y - this.#pos[i].y; len = Math.hypot(dx, dy); }
                if (len < eps) { this.#normals[i] = i > 0 ? this.#normals[i - 1] : d.vec2f(0, 1); continue; }
            }

            dx /= len; dy /= len;
            this.#normals[i] = d.vec2f(-dy, dx);
        }
    }

    #computeControlPoints() {
        for (let i = 0; i < this.n - 1; i++) {
            const A = this.#pos[i]; const B = this.#pos[i + 1];
            const nA = this.#normals[i]; const nB = this.#normals[i + 1];

            if (i === 0 || i === this.n - 2) { this.#controlPoints[i] = d.vec2f((A.x + B.x) * 0.5, (A.y + B.y) * 0.5); continue; }
            if (nA.x * nB.x + nA.y * nB.y > 0.99) { this.#controlPoints[i] = d.vec2f((A.x + B.x) * 0.5, (A.y + B.y) * 0.5); continue; }

            const tA = d.vec2f(nA.y, -nA.x); const tB = d.vec2f(nB.y, -nB.x);
            const dx = B.x - A.x; const dy = B.y - A.y;
            const denom = tA.x * tB.y - tA.y * tB.x;

            if (Math.abs(denom) <= 1e-6) { this.#controlPoints[i] = d.vec2f((A.x + B.x) * 0.5, (A.y + B.y) * 0.5); continue; }

            const t = (dx * tB.y - dy * tB.x) / denom;
            const cx = A.x + t * tA.x;
            const cy = A.y + t * tA.y;
            this.#controlPoints[i] = d.vec2f(cx, cy);
        }
    }

    #updateGPUBuffer() {
        this.pointsBuffer.write(this.#pos);
        this.controlPointsBuffer.write(this.#controlPoints);
        this.normalsBuffer.write(this.#normals);

        const len = this.#pos.length;
        const secondLast = this.#pos[len - 2];
        const last = this.#pos[len - 1];
        this.endCapUniform.write(d.vec4f(secondLast.x, secondLast.y, last.x, last.y));
    }
}

// ==========================================
// 8. Temporal Anti-Aliasing (TAA)
// ==========================================
const taaResolveFn = tgpu.computeFn({
    workgroupSize: [16, 16],
    in: { gid: d.builtin.globalInvocationId },
})(({ gid }) => {
    'use gpu';
    const currentColor = std.textureLoad(taaResolveLayout.$.currentTexture, d.vec2u(gid.xy), 0);
    const historyColor = std.textureLoad(taaResolveLayout.$.historyTexture, d.vec2u(gid.xy), 0);

    let minColor = d.vec3f(9999.0);
    let maxColor = d.vec3f(-9999.0);
    const dimensions = std.textureDimensions(taaResolveLayout.$.currentTexture);

    for (const x of tgpu.unroll([-1, 0, 1])) {
        for (const y of tgpu.unroll([-1, 0, 1])) {
            const sampleCoord = d.vec2i(gid.xy).add(d.vec2i(x, y));
            const clampedCoord = std.clamp(sampleCoord, d.vec2i(0, 0), d.vec2i(dimensions.xy).sub(d.vec2i(1)));
            const neighborColor = std.textureLoad(taaResolveLayout.$.currentTexture, clampedCoord, 0);

            minColor = std.min(minColor, neighborColor.rgb);
            maxColor = std.max(maxColor, neighborColor.rgb);
        }
    }

    const historyColorClamped = std.clamp(historyColor.rgb, minColor, maxColor);
    const uv = d.vec2f(gid.xy).div(d.vec2f(dimensions.xy));

    const textRegionMinX = d.f32(0.71);
    const textRegionMaxX = d.f32(0.85);
    const textRegionMinY = d.f32(0.47);
    const textRegionMaxY = d.f32(0.55);
    const borderSize = d.f32(0.02);

    const fadeInX = std.smoothstep(textRegionMinX - borderSize, textRegionMinX + borderSize, uv.x);
    const fadeOutX = d.f32(1.0) - std.smoothstep(textRegionMaxX - borderSize, textRegionMaxX + borderSize, uv.x);
    const fadeInY = std.smoothstep(textRegionMinY - borderSize, textRegionMinY + borderSize, uv.y);
    const fadeOutY = d.f32(1.0) - std.smoothstep(textRegionMaxY - borderSize, textRegionMaxY + borderSize, uv.y);

    const inTextRegion = fadeInX * fadeOutX * fadeInY * fadeOutY;
    const blendFactor = std.mix(d.f32(0.9), d.f32(0.7), inTextRegion);

    const resolvedColor = d.vec4f(std.mix(currentColor.rgb, historyColorClamped, blendFactor), 1.0);
    std.textureStore(taaResolveLayout.$.outputTexture, d.vec2u(gid.x, gid.y), resolvedColor);
});

function createTaaTextures(root, width, height) {
    return [0, 1].map(() => {
        const texture = root['~unstable']
            .createTexture({ size: [width, height], format: 'rgba8unorm' })
            .$usage('storage', 'sampled');
        return {
            write: texture.createView(d.textureStorage2d('rgba8unorm')),
            sampled: texture.createView(),
        };
    });
}

class TAAResolver {
    #pipeline; #textures; #root; #width; #height;

    constructor(root, width, height) {
        this.#root = root;
        this.#width = width;
        this.#height = height;
        this.#pipeline = root.createComputePipeline({ compute: taaResolveFn });
        this.#textures = createTaaTextures(root, width, height);
    }

    resolve(currentTexture, frameCount, currentFrame) {
        const previousFrame = 1 - currentFrame;
        this.#pipeline
            .with(
                this.#root.createBindGroup(taaResolveLayout, {
                    currentTexture,
                    historyTexture: frameCount === 1 ? currentTexture : this.#textures[previousFrame].sampled,
                    outputTexture: this.#textures[currentFrame].write,
                }),
            )
            .dispatchWorkgroups(Math.ceil(this.#width / 16), Math.ceil(this.#height / 16));
        return this.#textures[currentFrame].sampled;
    }

    resize(width, height) {
        this.#width = width;
        this.#height = height;
        this.#textures = createTaaTextures(this.#root, width, height);
    }

    getResolvedTexture(frame) { return this.#textures[frame].sampled; }
}


// ==========================================
// 9. Main Application Context Setup
// ==========================================
const root = await tgpu.init({
    device: { optionalFeatures: ['timestamp-query'] },
});

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
const canvas = document.getElementById('webgpu-canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const context = root.configureContext({ canvas, alphaMode: 'premultiplied' });

const hasTimestampQuery = root.enabledFeatures.has('timestamp-query');
const NUM_POINTS = 17;

const slider = new Slider(root, d.vec2f(-1, 0), d.vec2f(0.9, 0), NUM_POINTS, -0.03);
const bezierTexture = slider.bezierTexture.createView();
const bezierBbox = slider.bbox;

const digitsProvider = new NumberProvider(root);
await digitsProvider.fillAtlas();
const digitsTextureView = digitsProvider.digitTextureAtlas.createView(d.texture2dArray(d.f32));

let qualityScale = 0.5;
let [width, height] = [Math.floor(canvas.width * qualityScale), Math.floor(canvas.height * qualityScale)];

let textures = createTextures(root, width, height);
let backgroundTexture = createBackgroundTexture(root, width, height);

const filteringSampler = root['~unstable'].createSampler({ magFilter: 'linear', minFilter: 'linear' });

const camera = new CameraController(root, d.vec3f(0.024, 2.7, 1.9), d.vec3f(0, 0, 0), d.vec3f(0, 1, 0), Math.PI / 4, width, height);
const cameraUniform = camera.cameraUniform;

const lightUniform = root.createUniform(DirectionalLight, {
    direction: std.normalize(d.vec3f(0.19, -0.24, 0.75)),
    color: d.vec3f(1, 1, 1),
});

const jellyColorUniform = root.createUniform(d.vec4f, d.vec4f(1.0, 0.45, 0.075, 1.0));
const randomUniform = root.createUniform(d.vec2f);
const blurEnabledUniform = root.createUniform(d.u32, 0);

// ----------------------------------------------------
// Shaders definition 
// using tgpu.fn() allows the code to be safely parsed natively
// ----------------------------------------------------
const getRay = tgpu.fn([d.vec2f], Ray)((ndc) => {
    'use gpu';
    const clipPos = d.vec4f(ndc.x, ndc.y, -1.0, 1.0);
    const invView = cameraUniform.$.viewInv;
    const invProj = cameraUniform.$.projInv;

    const viewPos = invProj.mul(clipPos);
    const viewPosNormalized = d.vec4f(viewPos.xyz.div(viewPos.w), 1.0);
    const worldPos = invView.mul(viewPosNormalized);
    const rayOrigin = invView.columns[3].xyz;
    const rayDir = std.normalize(worldPos.xyz.sub(rayOrigin));

    return Ray({ origin: rayOrigin, direction: rayDir });
});

const getSliderBbox = tgpu.fn([], SdfBbox)(() => {
    'use gpu';
    return SdfBbox({
        left: d.f32(bezierBbox[3]), right: d.f32(bezierBbox[1]),
        bottom: d.f32(bezierBbox[2]), top: d.f32(bezierBbox[0])
    });
});

const sdInflatedPolyline2D = tgpu.fn([d.vec2f], LineInfo)((p) => {
    'use gpu';
    const bbox = getSliderBbox();
    const uv = d.vec2f(
        (p.x - bbox.left) / (bbox.right - bbox.left),
        (bbox.top - p.y) / (bbox.top - bbox.bottom),
    );
    const clampedUV = std.saturate(uv);
    const sampledColor = std.textureSampleLevel(bezierTexture.$, filteringSampler.$, clampedUV, 0);

    return LineInfo({ t: sampledColor.y, distance: sampledColor.x, normal: sampledColor.zw });
});

const cap3D = tgpu.fn([d.vec3f], d.f32)((position) => {
    'use gpu';
    const endCap = slider.endCapUniform.$;
    const secondLastPoint = d.vec2f(endCap.x, endCap.y);
    const lastPoint = d.vec2f(endCap.z, endCap.w);
    const angle = std.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
    const rot = d.mat2x2f(std.cos(angle), -std.sin(angle), std.sin(angle), std.cos(angle));

    let pieP = position.sub(d.vec3f(secondLastPoint, 0));
    pieP = d.vec3f(rot.mul(pieP.xy), pieP.z);
    const hmm = sdf.sdPie(pieP.zx, d.vec2f(1, 0), LINE_HALF_THICK);
    return sdf.opExtrudeY(pieP, hmm, 0.001) - LINE_RADIUS;
});

const sliderSdf3D = tgpu.fn([d.vec3f], LineInfo)((position) => {
    'use gpu';
    const poly2D = sdInflatedPolyline2D(position.xy);
    let finalDist = d.f32(0.0);
    if (poly2D.t > 0.94) {
        finalDist = cap3D(position);
    } else {
        finalDist = sdf.opExtrudeZ(position, poly2D.distance, LINE_HALF_THICK) - LINE_RADIUS;
    }
    return LineInfo({ t: poly2D.t, distance: finalDist, normal: poly2D.normal });
});

const GroundParams = { groundThickness: 0.03, groundRoundness: 0.02 };

const rectangleCutoutDist = tgpu.fn([d.vec2f], d.f32)((position) => {
    'use gpu';
    const roundness = GroundParams.groundRoundness;
    return sdf.sdRoundedBox2d(position, d.vec2f(1 + roundness, 0.2 + roundness), 0.2 + roundness);
});

const getMainSceneDist = tgpu.fn([d.vec3f], d.f32)((position) => {
    'use gpu';
    const thickness = GroundParams.groundThickness;
    const roundness = GroundParams.groundRoundness;
    return sdf.opUnion(
        sdf.sdPlane(position, d.vec3f(0, 1, 0), 0.06),
        sdf.opExtrudeY(position, -rectangleCutoutDist(position.xz), thickness - roundness) - roundness,
    );
});

const sliderApproxDist = tgpu.fn([d.vec3f], d.f32)((position) => {
    'use gpu';
    const bbox = getSliderBbox();
    const p = position.xy;
    if (p.x < bbox.left || p.x > bbox.right || p.y < bbox.bottom || p.y > bbox.top) return 1e9;
    const poly2D = sdInflatedPolyline2D(p);
    return sdf.opExtrudeZ(position, poly2D.distance, LINE_HALF_THICK) - LINE_RADIUS;
});

const getSceneDist = tgpu.fn([d.vec3f], HitInfo)((position) => {
    'use gpu';
    const mainScene = getMainSceneDist(position);
    const poly3D = sliderSdf3D(position);
    const hitInfo = HitInfo();

    if (poly3D.distance < mainScene) {
        hitInfo.distance = poly3D.distance;
        hitInfo.objectType = ObjectType.SLIDER;
        hitInfo.t = poly3D.t;
    } else {
        hitInfo.distance = mainScene;
        hitInfo.objectType = ObjectType.BACKGROUND;
    }
    return hitInfo;
});

const getSceneDistForAO = tgpu.fn([d.vec3f], d.f32)((position) => {
    'use gpu';
    const mainScene = getMainSceneDist(position);
    const sliderApprox = sliderApproxDist(position);
    return std.min(mainScene, sliderApprox);
});

const sdfSlot = tgpu.slot();

const getNormalFromSdf = tgpu.fn([d.vec3f, d.f32], d.vec3f)((position, epsilon) => {
    'use gpu';
    const k = d.vec3f(1, -1, 0);
    const offset1 = k.xyy.mul(epsilon);
    const offset2 = k.yyx.mul(epsilon);
    const offset3 = k.yxy.mul(epsilon);
    const offset4 = k.xxx.mul(epsilon);

    const sample1 = offset1.mul(sdfSlot.$(position.add(offset1)));
    const sample2 = offset2.mul(sdfSlot.$(position.add(offset2)));
    const sample3 = offset3.mul(sdfSlot.$(position.add(offset3)));
    const sample4 = offset4.mul(sdfSlot.$(position.add(offset4)));

    const gradient = sample1.add(sample2).add(sample3).add(sample4);
    return std.normalize(gradient);
});

const getNormalCapSdf = getNormalFromSdf.with(sdfSlot, cap3D);
const getNormalMainSdf = getNormalFromSdf.with(sdfSlot, getMainSceneDist);

const getNormalCap = tgpu.fn([d.vec3f], d.vec3f)((pos) => {
    'use gpu';
    return getNormalCapSdf(pos, 0.01);
});

const getNormalMain = tgpu.fn([d.vec3f], d.vec3f)((position) => {
    'use gpu';
    if (std.abs(position.z) > 0.22 || std.abs(position.x) > 1.02) return d.vec3f(0, 1, 0);
    return getNormalMainSdf(position, 0.0001);
});

const getSliderNormal = tgpu.fn([d.vec3f, HitInfo], d.vec3f)((position, hitInfo) => {
    'use gpu';
    const poly2D = sdInflatedPolyline2D(position.xy);
    const gradient2D = poly2D.normal;

    const threshold = LINE_HALF_THICK * 0.85;
    const absZ = std.abs(position.z);
    const zDistance = std.max(0, ((absZ - threshold) * LINE_HALF_THICK) / (LINE_HALF_THICK - threshold));
    const edgeDistance = LINE_RADIUS - poly2D.distance;

    const edgeContrib = 0.9;
    const zContrib = 1.0 - edgeContrib;

    const zDirection = std.sign(position.z);
    const zAxisVector = d.vec3f(0, 0, zDirection);

    const edgeBlendDistance = edgeContrib * LINE_RADIUS + zContrib * LINE_HALF_THICK;
    const blendFactor = std.smoothstep(edgeBlendDistance, 0.0, zDistance * zContrib + edgeDistance * edgeContrib);

    const normal2D = d.vec3f(gradient2D.xy, 0);
    const blendedNormal = std.mix(zAxisVector, normal2D, blendFactor * 0.5 + 0.5);

    let normal = std.normalize(blendedNormal);

    if (hitInfo.t > 0.94) {
        const ratio = (hitInfo.t - 0.94) / 0.02;
        const fullNormal = getNormalCap(position);
        normal = std.normalize(std.mix(normal, fullNormal, ratio));
    }

    return normal;
});

const getNormal = tgpu.fn([d.vec3f, HitInfo], d.vec3f)((position, hitInfo) => {
    'use gpu';
    if (hitInfo.objectType === ObjectType.SLIDER && hitInfo.t < 0.96) {
        return getSliderNormal(position, hitInfo);
    }
    return std.select(getNormalCap(position), getNormalMain(position), hitInfo.objectType === ObjectType.BACKGROUND);
});

const sqLength = tgpu.fn([d.vec3f], d.f32)((a) => {
    'use gpu';
    return std.dot(a, a);
});

const getFakeShadow = tgpu.fn([d.vec3f, d.vec3f], d.vec3f)((position, lightDir) => {
    'use gpu';
    const jellyColor = jellyColorUniform.$;
    const endCapX = slider.endCapUniform.$.x;

    if (position.y < -GroundParams.groundThickness) {
        const fadeSharpness = 30;
        const inset = 0.02;
        const cutout = rectangleCutoutDist(position.xz) + inset;
        const edgeDarkening = std.saturate(1 - cutout * fadeSharpness);
        const lightGradient = std.saturate(-position.z * 4 * lightDir.z + 1);

        return d.vec3f(1).mul(edgeDarkening).mul(lightGradient * 0.5);
    } else {
        const finalUV = d.vec2f(
            (position.x - position.z * lightDir.x * std.sign(lightDir.z)) * 0.5 + 0.5,
            1 - (-position.z / lightDir.z) * 0.5 - 0.2,
        );
        const data = std.textureSampleLevel(bezierTexture.$, filteringSampler.$, finalUV, 0);

        const jellySaturation = std.mix(0, data.y, std.saturate(position.x * 1.5 + 1.1));
        const shadowColor = std.mix(d.vec3f(0, 0, 0), jellyColor.rgb, jellySaturation);

        const contrast = 20 * std.saturate(finalUV.y) * (0.8 + endCapX * 0.2);
        const shadowOffset = -0.3;
        const featherSharpness = 10;
        const uvEdgeFeather =
            std.saturate(finalUV.x * featherSharpness) *
            std.saturate((1 - finalUV.x) * featherSharpness) *
            std.saturate((1 - finalUV.y) * featherSharpness) *
            std.saturate(finalUV.y);
        const influence = std.saturate((1 - lightDir.y) * 2) * uvEdgeFeather;
        return std.mix(d.vec3f(1), std.mix(shadowColor, d.vec3f(1), std.saturate(data.x * contrast + shadowOffset)), influence);
    }
});

const calculateAO = tgpu.fn([d.vec3f, d.vec3f], d.f32)((position, normal) => {
    'use gpu';
    let totalOcclusion = d.f32(0.0);
    let sampleWeight = d.f32(1.0);
    const stepDistance = AO_RADIUS / AO_STEPS;

    for (let i = 1; i <= AO_STEPS; i++) {
        const sampleHeight = stepDistance * d.f32(i);
        const samplePosition = position.add(normal.mul(sampleHeight));
        const distanceToSurface = getSceneDistForAO(samplePosition) - AO_BIAS;
        const occlusionContribution = std.max(0.0, sampleHeight - distanceToSurface);
        totalOcclusion += occlusionContribution * sampleWeight;
        sampleWeight *= 0.5;
        if (totalOcclusion > AO_RADIUS / AO_INTENSITY) break;
    }

    const rawAO = 1.0 - (AO_INTENSITY * totalOcclusion) / AO_RADIUS;
    return std.saturate(rawAO);
});

const calculateLighting = tgpu.fn([d.vec3f, d.vec3f, d.vec3f], d.vec3f)((hitPosition, normal, rayOrigin) => {
    'use gpu';
    const lightDir = std.neg(lightUniform.$.direction);
    const fakeShadow = getFakeShadow(hitPosition, lightDir);
    const diffuse = std.max(std.dot(normal, lightDir), 0.0);

    const viewDir = std.normalize(rayOrigin.sub(hitPosition));
    const reflectDir = std.reflect(std.neg(lightDir), normal);
    const specularFactor = std.max(std.dot(viewDir, reflectDir), 0) ** SPECULAR_POWER;
    const specular = lightUniform.$.color.mul(specularFactor * SPECULAR_INTENSITY);
    const baseColor = d.vec3f(0.9);

    const directionalLight = baseColor.mul(lightUniform.$.color).mul(diffuse).mul(fakeShadow);
    const ambientLight = baseColor.mul(AMBIENT_COLOR).mul(AMBIENT_INTENSITY);
    const finalSpecular = specular.mul(fakeShadow);

    return std.saturate(directionalLight.add(ambientLight).add(finalSpecular));
});

const applyAO = tgpu.fn([d.vec3f, d.vec3f, d.vec3f], d.vec4f)((litColor, hitPosition, normal) => {
    'use gpu';
    const ao = calculateAO(hitPosition, normal);
    const finalColor = litColor.mul(ao);
    return d.vec4f(finalColor, 1.0);
});

const rayMarchNoJelly = tgpu.fn([d.vec3f, d.vec3f], d.vec3f)((rayOrigin, rayDirection) => {
    'use gpu';
    let distanceFromOrigin = d.f32();
    let hit = d.f32();

    for (let i = 0; i < 6; i++) {
        const p = rayOrigin.add(rayDirection.mul(distanceFromOrigin));
        hit = getMainSceneDist(p);
        distanceFromOrigin += hit;
        if (distanceFromOrigin > MAX_DIST || hit < SURF_DIST * 10) break;
    }

    if (distanceFromOrigin < MAX_DIST) {
        return renderBackground(rayOrigin, rayDirection, distanceFromOrigin, std.select(d.f32(), 0.87, blurEnabledUniform.$ === 1)).rgb;
    }
    return d.vec3f();
});

const renderPercentageOnGround = tgpu.fn([d.vec3f, d.vec3f, d.u32], d.vec4f)((hitPosition, center, percentage) => {
    'use gpu';
    const textWidth = 0.38;
    const textHeight = 0.33;

    if (std.abs(hitPosition.x - center.x) > textWidth * 0.5 || std.abs(hitPosition.z - center.z) > textHeight * 0.5) {
        return d.vec4f();
    }

    const localX = hitPosition.x - center.x;
    const localZ = hitPosition.z - center.z;

    const uvX = (localX + textWidth * 0.5) / textWidth;
    const uvZ = (localZ + textHeight * 0.5) / textHeight;

    if (uvX < 0.0 || uvX > 1.0 || uvZ < 0.0 || uvZ > 1.0) return d.vec4f();

    return std.textureSampleLevel(digitsTextureView.$, filteringSampler.$, d.vec2f(uvX, uvZ), percentage, 0);
});

const renderBackground = tgpu.fn([d.vec3f, d.vec3f, d.f32, d.f32], d.vec4f)((rayOrigin, rayDirection, backgroundHitDist, offset) => {
    'use gpu';
    const hitPosition = rayOrigin.add(rayDirection.mul(backgroundHitDist));
    const percentageSample = renderPercentageOnGround(hitPosition, d.vec3f(0.72, 0, 0), d.u32((slider.endCapUniform.$.x + 0.43) * 84));

    let highlights = d.f32();
    const highlightWidth = d.f32(1);
    const highlightHeight = 0.2;
    let offsetX = d.f32();
    let offsetZ = d.f32(0.05);

    const lightDir = lightUniform.$.direction;
    const causticScale = 0.2;
    offsetX -= lightDir.x * causticScale;
    offsetZ += lightDir.z * causticScale;

    const endCapX = slider.endCapUniform.$.x;
    const sliderStretch = (endCapX + 1) * 0.5;

    if (std.abs(hitPosition.x + offsetX) < highlightWidth && std.abs(hitPosition.z + offsetZ) < highlightHeight) {
        const uvX_orig = ((hitPosition.x + offsetX + highlightWidth * 2) / highlightWidth) * 0.5;
        const uvZ_orig = ((hitPosition.z + offsetZ + highlightHeight * 2) / highlightHeight) * 0.5;

        const centeredUV = d.vec2f(uvX_orig - 0.5, uvZ_orig - 0.5);
        const finalUV = d.vec2f(centeredUV.x, 1 - (std.abs(centeredUV.y - 0.5) * 2) ** 2 * 0.3);

        const density = std.max(0, (std.textureSampleLevel(bezierTexture.$, filteringSampler.$, finalUV, 0).x - 0.25) * 8);

        const fadeX = std.smoothstep(0, -0.2, hitPosition.x - endCapX);
        const fadeZ = 1 - (std.abs(centeredUV.y - 0.5) * 2) ** 3;
        const fadeStretch = std.saturate(1 - sliderStretch);
        const edgeFade = std.saturate(fadeX) * std.saturate(fadeZ) * fadeStretch;

        highlights = (density ** 3 * edgeFade * 3 * (1 + lightDir.z)) / 1.5;
    }

    const originYBound = std.saturate(rayOrigin.y + 0.01);
    const posOffset = hitPosition.add(d.vec3f(0, 1, 0).mul(offset * (originYBound / (1.0 + originYBound)) * (1 + randf.sample() / 2)));
    const newNormal = getNormalMain(posOffset);

    const jellyColor = jellyColorUniform.$;
    const sqDist = sqLength(hitPosition.sub(d.vec3f(endCapX, 0, 0)));
    const bounceLight = jellyColor.rgb.mul((1 / (sqDist * 15 + 1)) * 0.4);
    const sideBounceLight = jellyColor.rgb.mul((1 / (sqDist * 40 + 1)) * 0.3).mul(std.abs(newNormal.z));

    const litColor = calculateLighting(posOffset, newNormal, rayOrigin);
    const backgroundColor = applyAO(GROUND_ALBEDO.mul(litColor), posOffset, newNormal)
        .add(d.vec4f(bounceLight, 0))
        .add(d.vec4f(sideBounceLight, 0));

    const textColor = std.saturate(backgroundColor.rgb.mul(d.vec3f(0.5)));

    return d.vec4f(std.mix(backgroundColor.rgb, textColor, percentageSample.x).mul(1.0 + highlights), 1.0);
});

const rayMarch = tgpu.fn([d.vec3f, d.vec3f, d.vec2f], d.vec4f)((rayOrigin, rayDirection, _uv) => {
    'use gpu';
    let totalSteps = d.u32();
    let backgroundDist = d.f32();

    for (let i = 0; i < MAX_STEPS; i++) {
        const p = rayOrigin.add(rayDirection.mul(backgroundDist));
        const hit = getMainSceneDist(p);
        backgroundDist += hit;
        if (hit < SURF_DIST) break;
    }

    const background = renderBackground(rayOrigin, rayDirection, backgroundDist, d.f32());
    const bbox = getSliderBbox();
    const zDepth = d.f32(0.25);
    const sliderMin = d.vec3f(bbox.left, bbox.bottom, -zDepth);
    const sliderMax = d.vec3f(bbox.right, bbox.top, zDepth);

    const intersection = intersectBox(rayOrigin, rayDirection, sliderMin, sliderMax);
    if (!intersection.hit) return background;

    let distanceFromOrigin = std.max(d.f32(0.0), intersection.tMin);

    for (let i = 0; i < MAX_STEPS; i++) {
        if (totalSteps >= MAX_STEPS) break;

        const currentPosition = rayOrigin.add(rayDirection.mul(distanceFromOrigin));
        const hitInfo = getSceneDist(currentPosition);
        distanceFromOrigin += hitInfo.distance;
        totalSteps++;

        if (hitInfo.distance < SURF_DIST) {
            const hitPosition = rayOrigin.add(rayDirection.mul(distanceFromOrigin));

            if (!(hitInfo.objectType === ObjectType.SLIDER)) break;

            const N = getNormal(hitPosition, hitInfo);
            const I = rayDirection;
            const cosi = std.min(1.0, std.max(0.0, std.dot(std.neg(I), N)));
            const F = fresnelSchlick(cosi, d.f32(1.0), d.f32(JELLY_IOR));

            const reflection = std.saturate(d.vec3f(hitPosition.y + 0.2));

            const eta = 1.0 / JELLY_IOR;
            const k = 1.0 - eta * eta * (1.0 - cosi * cosi);
            let refractedColor = d.vec3f();

            if (k > 0.0) {
                const refrDir = std.normalize(std.add(I.mul(eta), N.mul(eta * cosi - std.sqrt(k))));
                const p = hitPosition.add(refrDir.mul(SURF_DIST * 2.0));
                const exitPos = p.add(refrDir.mul(SURF_DIST * 2.0));

                const env = rayMarchNoJelly(exitPos, refrDir);
                const progress = hitInfo.t;
                const jellyColor = jellyColorUniform.$;

                const scatterTint = jellyColor.rgb.mul(1.5);
                const density = d.f32(20.0);
                const absorb = d.vec3f(1.0).sub(jellyColor.rgb).mul(density);
                const T = beerLambert(absorb.mul(progress ** 2), 0.08);

                const lightDir = std.neg(lightUniform.$.direction);
                const forward = std.max(0.0, std.dot(lightDir, refrDir));
                const scatter = scatterTint.mul(JELLY_SCATTER_STRENGTH * forward * progress ** 3);
                refractedColor = env.mul(T).add(scatter);
            }

            const jelly = std.add(reflection.mul(F), refractedColor.mul(1 - F));
            return d.vec4f(jelly, 1.0);
        }

        if (distanceFromOrigin > backgroundDist) break;
    }

    return background;
});

const raymarchFn = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
})(({ uv }) => {
    'use gpu';
    randf.seed2(randomUniform.$.mul(uv));

    const ndc = d.vec2f(uv.x * 2 - 1, -(uv.y * 2 - 1));
    const ray = getRay(ndc);
    const color = rayMarch(ray.origin, ray.direction, uv);

    return d.vec4f(std.tanh(color.rgb.mul(1.3)), 1);
});

const fragmentMain = tgpu.fragmentFn({
    in: { uv: d.vec2f },
    out: d.vec4f,
})((input) => {
    'use gpu';
    return std.textureSample(sampleLayout.$.currentTexture, filteringSampler.$, input.uv);
});

const rayMarchPipeline = root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: raymarchFn,
    targets: { format: 'rgba8unorm' },
});

const renderPipeline = root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: fragmentMain,
    targets: { format: presentationFormat },
});

// ==========================================
// 10. Frame Rendering Hookups
// ==========================================
const eventHandler = new EventHandler(canvas);
let lastTimeStamp = performance.now();
let frameCount = 0;
const taaResolver = new TAAResolver(root, width, height);

let attributionDismissed = false;
const attributionElement = document.getElementById('attribution');

function dismissAttribution() {
    if (!attributionDismissed && attributionElement) {
        attributionElement.style.opacity = '0';
        attributionElement.style.pointerEvents = 'none';
        attributionDismissed = true;
    }
}

canvas.addEventListener('mousedown', dismissAttribution, { once: true });
canvas.addEventListener('touchstart', dismissAttribution, { once: true });
canvas.addEventListener('wheel', dismissAttribution, { once: true });

function createBindGroups() {
    return {
        rayMarch: root.createBindGroup(rayMarchLayout, { backgroundTexture: backgroundTexture.sampled }),
        render: [0, 1].map((frame) => root.createBindGroup(sampleLayout, { currentTexture: taaResolver.getResolvedTexture(frame) })),
    };
}

let bindGroups = createBindGroups();
let animationFrameHandle;

function render(timestamp) {
    frameCount++;
    camera.jitter();
    const deltaTime = Math.min((timestamp - lastTimeStamp) * 0.001, 0.1);
    lastTimeStamp = timestamp;

    randomUniform.write(d.vec2f((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));

    eventHandler.update();
    slider.setDragX(eventHandler.currentMouseX);
    slider.update(deltaTime);

    const currentFrame = frameCount % 2;

    rayMarchPipeline.withColorAttachment({
        view: textures[currentFrame].sampled,
        loadOp: 'clear',
        storeOp: 'store',
    }).draw(3);

    taaResolver.resolve(textures[currentFrame].sampled, frameCount, currentFrame);

    renderPipeline.withColorAttachment({ view: context })
        .with(bindGroups.render[currentFrame])
        .draw(3);

    animationFrameHandle = requestAnimationFrame(render);
}

function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    width = Math.floor(canvas.width * qualityScale);
    height = Math.floor(canvas.height * qualityScale);

    camera.updateProjection(Math.PI / 4, width, height);
    textures = createTextures(root, width, height);
    backgroundTexture = createBackgroundTexture(root, width, height);
    taaResolver.resize(width, height);
    frameCount = 0;
    bindGroups = createBindGroups();
}

window.addEventListener('resize', handleResize);

// Auto set visual quality based on initial profiling to maintain 60FPS
async function autoSetQuality() {
    if (!hasTimestampQuery) return 0.5;

    const targetFrameTime = 5;
    const tolerance = 2.0;
    let resolutionScale = 0.3;
    let lastTimeMs = 0;

    const measurePipeline = rayMarchPipeline.withPerformanceCallback((start, end) => {
        lastTimeMs = Number(end - start) / 1e6;
    });

    for (let i = 0; i < 8; i++) {
        const testTexture = root['~unstable']
            .createTexture({ size: [Math.floor(canvas.width * resolutionScale), Math.floor(canvas.height * resolutionScale)], format: 'rgba8unorm' })
            .$usage('render');

        measurePipeline.withColorAttachment({ view: testTexture, loadOp: 'clear', storeOp: 'store' })
            .draw(3);

        await root.device.queue.onSubmittedWorkDone();
        testTexture.destroy();

        if (Math.abs(lastTimeMs - targetFrameTime) < tolerance) break;

        const adjustment = lastTimeMs > targetFrameTime ? -0.1 : 0.1;
        resolutionScale = Math.max(0.3, Math.min(1.0, resolutionScale + adjustment));
    }

    console.log(`Auto-selected rendering quality scale: ${resolutionScale.toFixed(2)}`);
    return resolutionScale;
}

autoSetQuality().then((scale) => {
    qualityScale = scale;
    handleResize();
    animationFrameHandle = requestAnimationFrame(render);
});

