// ==========================================
// App Entry: Render Loop & Resize
// ==========================================
import { scene, camera, renderer, torusGroup, frustumSize, blocks, interactableMeshes } from './scene.js';
import { raycaster, mouse, getState, setState } from './interaction.js';

// --- Render Loop ---
function animate() {
    requestAnimationFrame(animate);

    const state = getState();

    // Raycast (only when idle)
    if (!state.activeBlock && !state.isAnimating) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableMeshes);

        if (intersects.length > 0) {
            setState('hoveredBlock', intersects[0].object.userData.parentGroup);
            document.body.style.cursor = 'pointer';
            setState('targetSpeed', 0);
        } else {
            setState('hoveredBlock', null);
            document.body.style.cursor = 'default';
            setState('targetSpeed', 0.008);
        }
    }

    // Smooth rotation
    const newSpeed = state.currentSpeed + (state.targetSpeed - state.currentSpeed) * 0.05;
    setState('currentSpeed', newSpeed);
    torusGroup.rotation.y += newSpeed;

    // Per-block dimming & scaling
    const currentState = getState();
    blocks.forEach(block => {
        let targetScale = 1.0;
        let targetColor = 1.0;
        let targetOpacity = 0.95;

        if (currentState.activeBlock) {
            if (block === currentState.activeBlock) {
                targetColor = 1.0;
                targetOpacity = 1.0;
            } else {
                targetColor = 0.2;
                targetOpacity = 0.15;
            }
        } else if (currentState.hoveredBlock) {
            if (block === currentState.hoveredBlock) {
                targetScale = 1.15;
                targetColor = 1.0;
                targetOpacity = 1.0;
            } else {
                targetScale = 0.96;
                targetColor = 0.4;
                targetOpacity = 0.35;
            }
        }

        if (block !== currentState.activeBlock) {
            block.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
        }

        const meshMat = block.userData.mesh.material;
        const edgeMat = block.userData.edges.material;

        meshMat.color.r += (targetColor - meshMat.color.r) * 0.12;
        meshMat.color.g += (targetColor - meshMat.color.g) * 0.12;
        meshMat.color.b += (targetColor - meshMat.color.b) * 0.12;
        edgeMat.opacity += (targetOpacity - edgeMat.opacity) * 0.12;
    });

    renderer.render(scene, camera);
}

// --- Responsive Resize ---
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
