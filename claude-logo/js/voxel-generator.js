import * as THREE from 'three';
import { CONFIG } from './config.js';

/* 
 * ============================================================================
 * PROCEDURAL 3D VOXEL EXTRACTION ENGINE (MATHEMATICS)
 * ============================================================================
 * This system renders the raw SVG to a hidden 2D Canvas, extracts the 
 * pixel data, computes a Signed Distance Field (SDF), and uses it to 
 * generate a watertight, 3D hollow shell of perfectly aligned voxels.
 * Exceedingly complex to guarantee high-performance, hollow-core InstancedMesh.
 */
export class VoxelMatrixGenerator {
    constructor() {
        this.voxels = [];
        this.size = CONFIG.voxel.gridSize;
    }

    async synthesize() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = this.size;
            canvas.height = this.size;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // 1. Render Vector to Canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, this.size, this.size);

            // Perfectly center the 100x100 viewBox SVG inside our grid
            ctx.translate(this.size / 2, this.size / 2);
            const scale = (this.size * 0.85) / 100;
            ctx.scale(scale, scale);
            ctx.translate(-50, -50);

            ctx.fillStyle = '#FFFFFF';
            ctx.fill(new Path2D(CONFIG.svgPath));

            // 2. Extract Binary Map
            const imgData = ctx.getImageData(0, 0, this.size, this.size).data;
            const binaryGrid = new Int32Array(this.size * this.size);
            for (let i = 0; i < this.size * this.size; i++) {
                // Any pixel with white becomes a solid matrix block
                binaryGrid[i] = imgData[i * 4] > 128 ? 1 : 0;
            }

            // 3. Multi-Pass Chamfer Distance Transform (SDF)
            // Calculates Manhattan distance to the nearest edge for volumetric depth.
            const distField = new Int32Array(this.size * this.size);
            for (let i = 0; i < this.size * this.size; i++) distField[i] = binaryGrid[i];

            let requiresUpdate = true;
            let maxDepthFound = 0;

            while (requiresUpdate) {
                requiresUpdate = false;
                for (let y = 1; y < this.size - 1; y++) {
                    for (let x = 1; x < this.size - 1; x++) {
                        const i = y * this.size + x;
                        if (distField[i] > 0) {
                            const minEdge = Math.min(
                                distField[i - 1],       // Left
                                distField[i + 1],       // Right
                                distField[i - this.size], // Top
                                distField[i + this.size]  // Bottom
                            );
                            if (minEdge === distField[i]) {
                                distField[i] = minEdge + 1;
                                requiresUpdate = true;
                                if (distField[i] > maxDepthFound) maxDepthFound = distField[i];
                            }
                        }
                    }
                }
            }

            // 4. Generate 3D Voxel Coordinates (Hollow Shell Optimization)
            // We only generate voxels that are visible to the camera.
            // This reduces rendering load from 150,000+ to around 20,000.

            const getZDepth = (distance) => Math.max(1, Math.floor(Math.pow(distance, 0.75) * CONFIG.voxel.depthMultiplier));

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            for (let y = 0; y < this.size; y++) {
                for (let x = 0; x < this.size; x++) {
                    const d = distField[y * this.size + x];
                    if (d > 0) {
                        const localDepth = getZDepth(d);

                        for (let z = -localDepth; z <= localDepth; z++) {

                            // Surface Detection Logic
                            let isSurface = false;
                            if (z === -localDepth || z === localDepth) {
                                isSurface = true;
                            } else {
                                const nL = x > 0 ? distField[y * this.size + x - 1] : 0;
                                const nR = x < this.size - 1 ? distField[y * this.size + x + 1] : 0;
                                const nT = y > 0 ? distField[(y - 1) * this.size + x] : 0;
                                const nB = y < this.size - 1 ? distField[(y + 1) * this.size + x] : 0;

                                const minNDepth = Math.min(
                                    getZDepth(nL), getZDepth(nR),
                                    getZDepth(nT), getZDepth(nB)
                                );

                                if (Math.abs(z) > minNDepth) {
                                    isSurface = true;
                                }
                            }

                            if (isSurface) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;

                                this.voxels.push({
                                    rawX: x, rawY: y, rawZ: z,
                                    dist: d,
                                    maxDist: maxDepthFound
                                });
                            }
                        }
                    }
                }
            }

            // 5. Finalize Coordinates & Pre-bake Lighting Colors
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const cBase = new THREE.Color(CONFIG.colors.base);
            const cDark = new THREE.Color(CONFIG.colors.shadow);
            const cBright = new THREE.Color(CONFIG.colors.highlight);

            const finalData = this.voxels.map(v => {
                // Center in 3D Space and invert Y
                const fx = (v.rawX - centerX) * CONFIG.voxel.spacing;
                const fy = -(v.rawY - centerY) * CONFIG.voxel.spacing;
                const fz = v.rawZ * CONFIG.voxel.spacing;

                // Procedural Ambient Occlusion Baking
                const vertexColor = new THREE.Color();
                const depthRatio = v.dist / v.maxDist;

                if (v.dist <= 1) {
                    // Outer sharp edges catch highlights
                    vertexColor.copy(cBase).lerp(cBright, 0.3);
                } else {
                    // Inner structural valleys recede into shadow
                    vertexColor.copy(cBase).lerp(cDark, 1.0 - depthRatio);
                }

                // Add microscopic variance to break CGI perfection
                vertexColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);

                // Calculate cascade assembly delay based on radial distance
                const rDist = Math.hypot(fx, fy, fz);
                const animDelay = rDist * 0.035 + Math.random() * 0.5;

                return {
                    x: fx, y: fy, z: fz,
                    color: vertexColor,
                    delay: animDelay,
                    phase: Math.random() * Math.PI * 2.0 // Random offset for chaos
                };
            });

            console.log(`[Engine] Synchronized ${finalData.length} Voxel Instances`);
            resolve(finalData);
        });
    }
}
