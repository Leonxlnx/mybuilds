import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from './config.js';
import { VoxelMatrixGenerator } from './voxel-generator.js';
import { CUSTOM_GLSL_UTILS } from './shaders.js';

/* 
 * ============================================================================
 * MAIN THREE.JS APPLICATION ORCHESTRATOR
 * ============================================================================
 * Sets up the scene, post-processing, lights, and rendering loop.
 */
class ClaudePixelEngine {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.clock = new THREE.Clock();
        this.shaderUniforms = { uTime: { value: 0 } };

        this.init();
    }

    async init() {
        // Generate mathematics first
        const generator = new VoxelMatrixGenerator();
        this.voxelData = await generator.synthesize();

        // Setup Environment
        this.setupScene();
        this.setupLights();
        this.buildVoxelMesh();
        this.setupPostProcessing();

        // Event Listeners
        window.addEventListener('resize', this.onResize.bind(this), false);

        // Reveal Masterpiece smoothly
        setTimeout(() => {
            const loader = document.getElementById('preloader');
            loader.style.opacity = '0';
            setTimeout(() => loader.style.visibility = 'hidden', 1500);

            this.clock.start();
            this.animate();
        }, 600);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        // Subtle fog to blend distant geometries perfectly into the background
        this.scene.fog = new THREE.FogExp2(CONFIG.colors.ambient, 0.0035);

        this.camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 0, CONFIG.anim.cameraDistance);

        // Multi-sampled WebGL2 Renderer for pristine edges (Pixel Art perfection)
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Filmic HDR Tone Mapping
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // High Quality Shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Rotational Container for majestic cinematic movement
        this.worldGroup = new THREE.Group();
        this.scene.add(this.worldGroup);
    }

    setupLights() {
        // Warm ambient base
        const ambient = new THREE.AmbientLight(0xffebd6, 0.6);
        this.scene.add(ambient);

        // Primary Studio Key Light
        const keyLight = new THREE.DirectionalLight(0xffeedd, 3.0);
        keyLight.position.set(60, 100, 80);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.bias = -0.001;
        keyLight.shadow.camera.near = 10;
        keyLight.shadow.camera.far = 400;
        const d = 100;
        keyLight.shadow.camera.left = -d;
        keyLight.shadow.camera.right = d;
        keyLight.shadow.camera.top = d;
        keyLight.shadow.camera.bottom = -d;
        this.scene.add(keyLight);

        // Deep Cool Fill Light for shadow contrast
        const fillLight = new THREE.DirectionalLight(0x4a6d8c, 1.5);
        fillLight.position.set(-80, -40, -50);
        this.scene.add(fillLight);

        // Back Rim Light to separate voxels from the dark void
        const rimLight = new THREE.DirectionalLight(0xffc2a3, 2.5);
        rimLight.position.set(0, 60, -120);
        this.scene.add(rimLight);
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Unreal Bloom creates the gorgeous, high-end glowing effect
        // Specifically targeted at the highlights in our custom shader
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,   // Strength
            0.6,   // Radius
            0.85   // Threshold (Only bright orange glows)
        );
        this.composer.addPass(bloomPass);

        this.composer.addPass(new OutputPass());
    }

    buildVoxelMesh() {
        const count = this.voxelData.length;

        // The geometry dictates the "Pixel Art" style perfectly.
        // A BoxGeometry slightly smaller than the grid spacing creates pristine gaps.
        const geometry = new THREE.BoxGeometry(CONFIG.voxel.boxSize, CONFIG.voxel.boxSize, CONFIG.voxel.boxSize);

        // High-End Physically Based Rendering Material
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // Overridden by GPU vertex colors
            roughness: 0.3,
            metalness: 0.1
        });

        // Prepare GPU Attributes
        const aTarget = new Float32Array(count * 3);
        const aStart = new Float32Array(count * 3);
        const aColor = new Float32Array(count * 3);
        const aParams = new Float32Array(count * 3); // x: delay, y: phase, z: random speed
        const aAxis = new Float32Array(count * 3);

        this.voxelData.forEach((v, i) => {
            const i3 = i * 3;

            // Final Destination
            aTarget[i3 + 0] = v.x;
            aTarget[i3 + 1] = v.y;
            aTarget[i3 + 2] = v.z;

            // Starting Position (Massive chaotic spherical scatter)
            const radius = 350 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            aStart[i3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
            aStart[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            aStart[i3 + 2] = radius * Math.cos(phi) + 150; // Bias towards camera

            // Pre-baked Ambient Colors
            aColor[i3 + 0] = v.color.r;
            aColor[i3 + 1] = v.color.g;
            aColor[i3 + 2] = v.color.b;

            // Animation Parameters
            aParams[i3 + 0] = v.delay;
            aParams[i3 + 1] = v.phase;
            aParams[i3 + 2] = 0.5 + Math.random() * 1.5;

            // Flight Spin Axis
            const ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
            const len = Math.hypot(ax, ay, az) || 1.0;
            aAxis[i3 + 0] = ax / len;
            aAxis[i3 + 1] = ay / len;
            aAxis[i3 + 2] = az / len;
        });

        geometry.setAttribute('aTarget', new THREE.InstancedBufferAttribute(aTarget, 3));
        geometry.setAttribute('aStart', new THREE.InstancedBufferAttribute(aStart, 3));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
        geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(aParams, 3));
        geometry.setAttribute('aAxis', new THREE.InstancedBufferAttribute(aAxis, 3));

        // ============================================================================
        // INJECTING COMPLEX ANIMATION MATHEMATICS INTO THE RENDER PIPELINE
        // ============================================================================
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = this.shaderUniforms.uTime;

            shader.vertexShader = `
                uniform float uTime;
                attribute vec3 aStart;
                attribute vec3 aTarget;
                attribute vec3 aColor;
                attribute vec3 aParams;
                attribute vec3 aAxis;
                
                varying vec3 vColor;
                varying float vGlow;
                
                ${CUSTOM_GLSL_UTILS}
            ` + shader.vertexShader;

            // Override Vertex Normals for accurate light reflection during spinning
            shader.vertexShader = shader.vertexShader.replace(
                '#include <beginnormal_vertex>',
                `
                #include <beginnormal_vertex>
                
                float rawProg = (uTime - aParams.x) * 0.45;
                float tProg = clamp(rawProg, 0.0, 1.0);
                float eased = easeOutElastic(tProg);
                
                // Chaotic spin during assembly
                float spin = (1.0 - eased) * 20.0 * aParams.z;
                mat3 rotM = rotation3d(aAxis, spin);
                
                objectNormal = rotM * objectNormal;
                `
            );

            // Override Vertex Positions (The Animation Engine)
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // 1. Assembly Interpolation
                vec3 currentPos = mix(aStart, aTarget, eased);
                
                // 2. Idle Organic Simplex Noise Waving
                // Only applies after the voxel has fully snapped into place
                float idleTime = max(0.0, uTime - aParams.x - 2.5);
                if (idleTime > 0.0) {
                    // Fluid, non-repeating rippling effect
                    float noiseZ = snoise(vec3(aTarget.x * 0.03, aTarget.y * 0.03, idleTime * 0.3));
                    currentPos.z += noiseZ * 1.8;
                    
                    // Gentle breathing expansion
                    float breath = sin(idleTime * 2.0 - length(aTarget.xy) * 0.1) * 0.5;
                    currentPos.y += breath;
                }

                // 3. Apply Local Geometry Adjustments
                transformed = rotM * transformed; // Apply spin
                
                // Scale up from nothing
                float scalePop = smoothstep(0.0, 0.3, tProg);
                transformed *= scalePop;

                // Add macro position
                transformed += currentPos;

                // Pass variables to Fragment Shader
                vColor = aColor;
                
                // 4. Calculate Sweeping Glow Energy
                vGlow = 0.0;
                if (idleTime > 0.0) {
                    float dist = length(aTarget.xy);
                    float sweep = fract(idleTime * 0.2 - dist * 0.015);
                    if (sweep < 0.15) {
                        vGlow = sin((sweep / 0.15) * 3.1415) * 0.85;
                    }
                }
                `
            );

            shader.fragmentShader = `
                varying vec3 vColor;
                varying float vGlow;
            ` + shader.fragmentShader;

            // Override Color Output
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                vec3 finalColor = vColor;
                
                // Apply sweeping energy glow
                if (vGlow > 0.0) {
                    vec3 energyCore = vec3(1.0, 0.9, 0.8);
                    finalColor = mix(finalColor, energyCore, vGlow);
                    // Multiply > 1.0 to trigger Post-Processing Bloom Pass
                    finalColor *= (1.0 + vGlow * 2.0);
                }
                
                diffuseColor.rgb = finalColor;
                `
            );
        };

        // Depth Material is required to cast accurate shadows during animation
        const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        depthMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = this.shaderUniforms.uTime;
            shader.vertexShader = `
                uniform float uTime;
                attribute vec3 aStart;
                attribute vec3 aTarget;
                attribute vec3 aParams;
                attribute vec3 aAxis;
                ${CUSTOM_GLSL_UTILS}
            ` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float rawProg = (uTime - aParams.x) * 0.45;
                float tProg = clamp(rawProg, 0.0, 1.0);
                float eased = easeOutElastic(tProg);
                float spin = (1.0 - eased) * 20.0 * aParams.z;
                mat3 rotM = rotation3d(aAxis, spin);
                
                vec3 currentPos = mix(aStart, aTarget, eased);
                
                float idleTime = max(0.0, uTime - aParams.x - 2.5);
                if (idleTime > 0.0) {
                    float noiseZ = snoise(vec3(aTarget.x * 0.03, aTarget.y * 0.03, idleTime * 0.3));
                    currentPos.z += noiseZ * 1.8;
                    currentPos.y += sin(idleTime * 2.0 - length(aTarget.xy) * 0.1) * 0.5;
                }

                transformed = rotM * transformed;
                transformed *= smoothstep(0.0, 0.3, tProg);
                transformed += currentPos;
                `
            );
        };

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        this.instancedMesh.castShadow = true;
        this.instancedMesh.receiveShadow = true;
        this.instancedMesh.customDepthMaterial = depthMat;

        // Disable Frustum Culling due to dynamic shader positioning
        this.instancedMesh.frustumCulled = false;

        // Create a dummy matrix to initialize the buffer sizes
        const dummy = new THREE.Object3D();
        dummy.updateMatrix();
        for (let i = 0; i < count; i++) this.instancedMesh.setMatrixAt(i, dummy.matrix);

        this.worldGroup.add(this.instancedMesh);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        // Completely autonomous, un-controllable animation loop.
        requestAnimationFrame(this.animate.bind(this));

        const elapsedTime = this.clock.getElapsedTime();

        // 1. Sync time to GPU
        this.shaderUniforms.uTime.value = elapsedTime;

        // 2. Cinematic Global Orbiting
        // Smooth, majestic camera/world tracking to show off the 3D voxel structure
        const orbitAngle = elapsedTime * 0.15;
        this.worldGroup.rotation.y = Math.sin(orbitAngle) * 0.25 + elapsedTime * 0.12;
        this.worldGroup.rotation.x = Math.sin(elapsedTime * 0.2) * 0.15;

        // Gentle levitation
        this.worldGroup.position.y = Math.sin(elapsedTime * 1.5) * 3.0;

        // Subtle dynamic camera easing
        this.camera.position.x = Math.sin(elapsedTime * 0.1) * 20;
        this.camera.lookAt(0, 0, 0);

        // 3. Render Masterpiece
        this.composer.render();
    }
}

// ============================================================================
// BOOTSTRAP APPLICATION
// ============================================================================
window.onload = () => {
    new ClaudePixelEngine();
};
