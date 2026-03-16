// ==========================================
// CLOTHING TENSION & SPRING PHYSICS ENGINE
// ==========================================
class Spring {
    constructor(val, tension = 0.15, friction = 0.72) {
        this.val = val;
        this.target = val;
        this.vel = 0;
        this.tension = tension;
        this.friction = friction;
    }
    update() {
        const d = (this.target - this.val) * this.tension;
        this.vel = (this.vel + d) * this.friction;
        this.val += this.vel;
    }
}

const nav = document.getElementById('nav');
const items = document.querySelectorAll('.nav-btn, .divider');
const navItems = document.querySelectorAll('.nav-item');

// Global Container Physics state
const navPhysics = {
    rotX: new Spring(0, 0.1, 0.8),
    rotY: new Spring(0, 0.1, 0.8),
    scale: new Spring(1, 0.2, 0.7),
    dentScale: new Spring(0, 0.3, 0.7)
};

// Internal Element Physics state
const itemsPhysics = Array.from(items).map(el => ({
    el,
    x: new Spring(0, 0.15, 0.75),
    y: new Spring(0, 0.15, 0.75),
    scale: new Spring(1, 0.2, 0.75)
}));

let basePositions = [];
let isHovered = false;
let isPressed = false;
let pointerX = 0;
let pointerY = 0;
let activeItem = null;

// Cache positions for physics offset calculations
function cachePositions() {
    nav.style.transform = 'none';
    itemsPhysics.forEach(item => item.el.style.transform = 'none');
    void nav.offsetHeight; // Force DOM reflow

    basePositions = itemsPhysics.map(item => {
        const rect = item.el.getBoundingClientRect();
        return {
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2
        };
    });
}

window.addEventListener('resize', () => { if (!isPressed) cachePositions(); });
setTimeout(cachePositions, 100);

// Core 60fps Animation Loop
function animate() {
    navPhysics.rotX.update();
    navPhysics.rotY.update();
    navPhysics.scale.update();
    navPhysics.dentScale.update();

    nav.style.transform = `
        perspective(1000px) 
        rotateX(${navPhysics.rotX.val}deg) 
        rotateY(${navPhysics.rotY.val}deg) 
        scale(${navPhysics.scale.val})
    `;
    nav.style.setProperty('--dent-scale', navPhysics.dentScale.val);

    itemsPhysics.forEach(item => {
        item.x.update();
        item.y.update();
        item.scale.update();
        item.el.style.transform = `translate(${item.x.val}px, ${item.y.val}px) scale(${item.scale.val})`;
    });

    requestAnimationFrame(animate);
}
animate();

// ==========================================
// INTERACTION LISTENERS
// ==========================================
window.addEventListener('pointermove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;

    if (!basePositions.length) return;

    const navRect = nav.getBoundingClientRect();
    const centerX = navRect.left + navRect.width / 2;
    const centerY = navRect.top + navRect.height / 2;

    if (isPressed) {
        // Dent tracks under the finger
        nav.style.setProperty('--dent-x', `${pointerX - navRect.left}px`);
        nav.style.setProperty('--dent-y', `${pointerY - navRect.top}px`);

        // Container tilt for pressure simulation
        navPhysics.rotX.target = -((pointerY - centerY) / navRect.height) * 20;
        navPhysics.rotY.target = ((pointerX - centerX) / navRect.width) * 20;

        // Resolve target button
        let minDist = Infinity;
        activeItem = null;

        itemsPhysics.forEach((item, i) => {
            if (item.el.classList.contains('divider')) return;
            const base = basePositions[i];
            const dist = Math.sqrt((pointerX - base.cx)**2 + (pointerY - base.cy)**2);
            if (dist < 45 && dist < minDist) {
                minDist = dist;
                activeItem = item.el;
            }
        });

        // Material Stretching Physics
        itemsPhysics.forEach((item, i) => {
            const base = basePositions[i];
            const dx = pointerX - base.cx;
            const dy = pointerY - base.cy;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (item.el === activeItem) {
                item.scale.target = 0.82;
                item.x.target = dx * 0.2;
                item.y.target = dy * 0.2;
            } else {
                const pullRadius = 160;
                if (dist < pullRadius) {
                    const pullStrength = Math.pow(1 - dist / pullRadius, 2);
                    item.x.target = (dx / dist) * pullStrength * 22;
                    item.y.target = (dy / dist) * pullStrength * 22;

                    const isDiv = item.el.classList.contains('divider');
                    item.scale.target = 1 - (pullStrength * (isDiv ? 0.02 : 0.08));
                } else {
                    item.x.target = 0;
                    item.y.target = 0;
                    item.scale.target = 1;
                }
            }
        });

    } else if (isHovered) {
        // Gentle ambient 3D tilt
        navPhysics.rotX.target = -((pointerY - centerY) / navRect.height) * 12;
        navPhysics.rotY.target = ((pointerX - centerX) / navRect.width) * 12;

        itemsPhysics.forEach(item => {
            item.x.target = 0;
            item.y.target = 0;
            item.scale.target = 1;
        });
    }
});

nav.addEventListener('pointerenter', () => { isHovered = true; });

nav.addEventListener('pointerleave', () => {
    isHovered = false;
    if (!isPressed) {
        navPhysics.rotX.target = 0;
        navPhysics.rotY.target = 0;
    }
});

nav.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isPressed = true;
    nav.setPointerCapture(e.pointerId);

    navPhysics.scale.target = 0.96;
    navPhysics.dentScale.target = 1;

    const navRect = nav.getBoundingClientRect();
    nav.style.setProperty('--dent-x', `${pointerX - navRect.left}px`);
    nav.style.setProperty('--dent-y', `${pointerY - navRect.top}px`);

    cachePositions();
});

function handlePointerUp() {
    if (!isPressed) return;
    isPressed = false;

    navPhysics.scale.target = 1;
    navPhysics.dentScale.target = 0;

    if (!isHovered) {
        navPhysics.rotX.target = 0;
        navPhysics.rotY.target = 0;
    }

    itemsPhysics.forEach(item => {
        item.x.target = 0;
        item.y.target = 0;
        item.scale.target = 1;
    });

    if (activeItem) {
        if (activeItem.classList.contains('theme-switch')) {
            document.body.classList.toggle('dark');
        } else if (activeItem.classList.contains('nav-item')) {
            navItems.forEach(el => el.classList.remove('active'));
            activeItem.classList.add('active');
        }
    }
    activeItem = null;
}

nav.addEventListener('pointerup', handlePointerUp);
nav.addEventListener('pointercancel', handlePointerUp);

// Disable native behaviors
nav.addEventListener('dragstart', e => e.preventDefault());
nav.addEventListener('contextmenu', e => e.preventDefault());
