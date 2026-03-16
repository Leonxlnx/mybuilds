// ==========================================
// Interaction: Raycaster, Click, Close UI
// ==========================================
import {
    scene, camera, torusGroup,
    blocks, interactableMeshes
} from './scene.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-10, -10);

let hoveredBlock = null;
let activeBlock = null;
let isAnimating = false;

let currentSpeed = 0.008;
let targetSpeed = 0.008;

// --- Pointer Move ---
window.addEventListener('pointermove', (e) => {
    if (activeBlock || isAnimating) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- Click: Fly-Out Animation ---
window.addEventListener('click', (e) => {
    if (isAnimating || activeBlock || !hoveredBlock) return;
    if (e.target.closest('#ui-container')) return;

    isAnimating = true;
    activeBlock = hoveredBlock;
    hoveredBlock = null;
    document.body.style.cursor = 'default';

    activeBlock.userData.localPos.copy(activeBlock.position);
    activeBlock.userData.localQuat.copy(activeBlock.quaternion);

    // Detach from ring → attach to world scene
    scene.attach(activeBlock);

    // Target position: centered in front of camera
    const camLocalPos = window.innerWidth > 768
        ? new THREE.Vector3(-2, 0, -10)
        : new THREE.Vector3(0, 4, -10);
    const targetPos = camLocalPos.applyMatrix4(camera.matrixWorld);
    const tiltQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.4, 0));
    const targetQuat = camera.quaternion.clone().multiply(tiltQuat);

    const tl = gsap.timeline();

    // Push torus back
    tl.to(torusGroup.position, { z: -3, duration: 1.2, ease: "power3.inOut" }, 0);

    // Fly block out
    tl.to(activeBlock.position, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z,
        duration: 1.2, ease: "power3.inOut"
    }, 0);
    tl.to(activeBlock.quaternion, {
        x: targetQuat.x, y: targetQuat.y, z: targetQuat.z, w: targetQuat.w,
        duration: 1.2, ease: "power3.inOut"
    }, 0);
    tl.to(activeBlock.scale, {
        x: 2.2, y: 2.2, z: 2.2,
        duration: 1.2, ease: "power3.inOut"
    }, 0);

    // Show UI
    document.getElementById('bg-overlay').classList.add('active');

    tl.to("#card", {
        opacity: 1, rotationX: 0, y: 0, scale: 1,
        duration: 1.0, ease: "back.out(1.2)", delay: 0.3,
        onComplete: () => { isAnimating = false; }
    }, 0);
});

// --- Close: Fly-Back Animation ---
function closeUI() {
    if (isAnimating || !activeBlock) return;
    isAnimating = true;

    const tl = gsap.timeline();

    document.getElementById('bg-overlay').classList.remove('active');
    tl.to("#card", {
        opacity: 0, rotationX: 15, y: 40, scale: 0.95,
        duration: 0.5, ease: "power3.in"
    }, 0);

    // Re-attach to ring
    torusGroup.attach(activeBlock);

    tl.to(torusGroup.position, { z: 0, duration: 1.2, ease: "power3.inOut" }, 0.2);
    tl.to(activeBlock.position, {
        x: activeBlock.userData.localPos.x,
        y: activeBlock.userData.localPos.y,
        z: activeBlock.userData.localPos.z,
        duration: 1.2, ease: "power3.inOut"
    }, 0.2);
    tl.to(activeBlock.quaternion, {
        x: activeBlock.userData.localQuat.x,
        y: activeBlock.userData.localQuat.y,
        z: activeBlock.userData.localQuat.z,
        w: activeBlock.userData.localQuat.w,
        duration: 1.2, ease: "power3.inOut"
    }, 0.2);
    tl.to(activeBlock.scale, {
        x: 1, y: 1, z: 1,
        duration: 1.2, ease: "power3.inOut",
        onComplete: () => {
            activeBlock = null;
            isAnimating = false;
            targetSpeed = 0.008;
            mouse.set(-10, -10);
        }
    }, 0.2);
}

document.getElementById('close-btn').addEventListener('click', closeUI);
document.getElementById('bg-overlay').addEventListener('click', closeUI);

// Export state for render loop
export {
    raycaster, mouse, blocks, interactableMeshes,
    hoveredBlock, activeBlock, isAnimating,
    currentSpeed, targetSpeed
};

// Mutable state getters/setters for the render loop
export function getState() {
    return { hoveredBlock, activeBlock, isAnimating, currentSpeed, targetSpeed };
}

export function setState(key, value) {
    if (key === 'hoveredBlock') hoveredBlock = value;
    else if (key === 'activeBlock') activeBlock = value;
    else if (key === 'isAnimating') isAnimating = value;
    else if (key === 'currentSpeed') currentSpeed = value;
    else if (key === 'targetSpeed') targetSpeed = value;
}
