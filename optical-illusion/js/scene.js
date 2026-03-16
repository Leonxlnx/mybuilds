// ==========================================
// Scene Setup, Camera, Renderer, Geometry
// ==========================================

// --- Dot Texture ---
function createDotTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';

    for (let i = 0; i < 400; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() > 0.9
            ? (Math.random() * 2.5 + 1.0)
            : (Math.random() * 1.0 + 0.4);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.globalAlpha = Math.random() * 0.7 + 0.3;
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
}

// --- Scene & Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 24;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2,
    frustumSize / 2, frustumSize / -2,
    -100, 100
);
camera.position.set(10, 15, 20);
camera.lookAt(0, 0, 0);

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- Torus Ring Group ---
const torusGroup = new THREE.Group();
scene.add(torusGroup);

// --- Materials ---
const baseFaceMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: createDotTexture(),
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2
});

const baseLineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95
});

// --- Geometry Constants ---
const R = 6.5;
const r = 1.8;
const numBlocks = 12;
const gapAngle = 0.05;
const curveSegments = 12;
const segmentAngle = (Math.PI * 2) / numBlocks;

const blocks = [];
const interactableMeshes = [];

function getPoint(angle, corner) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    let x, y;
    if (corner === 0) { x = R + r; y = r; }
    else if (corner === 1) { x = R - r; y = r; }
    else if (corner === 2) { x = R - r; y = -r; }
    else { x = R + r; y = -r; }
    return new THREE.Vector3(x * cosA, y, x * sinA);
}

// --- Build Blocks ---
for (let i = 0; i < numBlocks; i++) {
    const startAngle = i * segmentAngle + gapAngle / 2;
    const endAngle = (i + 1) * segmentAngle - gapAngle / 2;
    const midAngle = (startAngle + endAngle) / 2;

    const cx = R * Math.cos(midAngle);
    const cz = R * Math.sin(midAngle);

    const edgeVertices = [];
    const faceVertices = [];
    const faceUVs = [];

    function addLocal(arr, pt) {
        arr.push(pt.x - cx, pt.y, pt.z - cz);
    }

    function addQuad(p1, p2, p3, p4, u1, v1, u2, v2, u3, v3, u4, v4) {
        addLocal(faceVertices, p1); addLocal(faceVertices, p2); addLocal(faceVertices, p3);
        faceUVs.push(u1, v1, u2, v2, u3, v3);
        addLocal(faceVertices, p1); addLocal(faceVertices, p3); addLocal(faceVertices, p4);
        faceUVs.push(u1, v1, u3, v3, u4, v4);
    }

    for (let c = 0; c < 4; c++) {
        for (let s = 0; s < curveSegments; s++) {
            const t1 = s / curveSegments;
            const t2 = (s + 1) / curveSegments;
            const a1 = startAngle + t1 * (endAngle - startAngle);
            const a2 = startAngle + t2 * (endAngle - startAngle);
            const p1 = getPoint(a1, c);
            const p2 = getPoint(a2, c);

            addLocal(edgeVertices, p1);
            addLocal(edgeVertices, p2);

            addQuad(
                p1, getPoint(a1, (c + 1) % 4), getPoint(a2, (c + 1) % 4), p2,
                t1 * 3, c, t1 * 3, c + 1, t2 * 3, c + 1, t2 * 3, c
            );
        }
    }

    for (let c = 0; c < 4; c++) {
        addLocal(edgeVertices, getPoint(startAngle, c));
        addLocal(edgeVertices, getPoint(startAngle, (c + 1) % 4));
        addLocal(edgeVertices, getPoint(endAngle, c));
        addLocal(edgeVertices, getPoint(endAngle, (c + 1) % 4));
    }

    addQuad(
        getPoint(startAngle, 0), getPoint(startAngle, 3),
        getPoint(startAngle, 2), getPoint(startAngle, 1),
        0, 0, 1, 0, 1, 1, 0, 1
    );
    addQuad(
        getPoint(endAngle, 0), getPoint(endAngle, 1),
        getPoint(endAngle, 2), getPoint(endAngle, 3),
        0, 0, 1, 0, 1, 1, 0, 1
    );

    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(faceVertices, 3));
    faceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(faceUVs, 2));

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));

    const faceMat = baseFaceMat.clone();
    const lineMat = baseLineMat.clone();

    const mesh = new THREE.Mesh(faceGeo, faceMat);
    const edges = new THREE.LineSegments(edgeGeo, lineMat);

    const blockGroup = new THREE.Group();
    blockGroup.add(mesh);
    blockGroup.add(edges);
    blockGroup.position.set(cx, 0, cz);

    blockGroup.userData = {
        localPos: new THREE.Vector3(cx, 0, cz),
        localQuat: new THREE.Quaternion(),
        mesh: mesh,
        edges: edges
    };
    mesh.userData.parentGroup = blockGroup;

    torusGroup.add(blockGroup);
    blocks.push(blockGroup);
    interactableMeshes.push(mesh);
}

// Export for other modules
export {
    scene, camera, renderer, torusGroup, frustumSize,
    blocks, interactableMeshes
};
