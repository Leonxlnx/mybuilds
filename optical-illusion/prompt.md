# optical-illusion

## Prompt

> Create an interactive 3D optical illusion — an "impossible torus ring" using Three.js with an orthographic camera to create the illusion of impossible geometry. 
>
> The ring should be made of 12 separate segmented blocks arranged in a torus shape with small gaps between them. Each block has a dot-textured surface and visible wireframe edges.
>
> **Interaction:**
> - On hover: the hovered block scales up (pop-out effect), all others dim and shrink slightly, and the entire torus smoothly stops rotating.
> - On click: the hovered block detaches from the ring, flies out toward the camera with a GSAP animation, scales up 2.2x, and a glassmorphism UI card panel appears alongside it with a backdrop blur overlay.
> - Close button or overlay click: the block flies back to its exact original position in the ring (even if the ring rotated while the panel was open), the UI closes, and the rotation resumes smoothly.
>
> **Technical requirements:**
> - Orthographic camera for the "impossible geometry" illusion
> - Dot texture generated via Canvas (procedural, no external images)
> - Cloned materials per block for independent dimming
> - GSAP for all UI and 3D animations (fly-out, fly-back, card reveal)
> - `scene.attach()` / `torusGroup.attach()` for seamless parent-switching during animations
> - Smooth speed interpolation for rotation start/stop
> - Ultra-clean glassmorphism UI: dark glass card with image, tag, title, description, and animated close button
> - Fully responsive (mobile: card centered, desktop: card offset)
> - Pure black background (#000000)

## Tech Stack

- **Three.js** r128 — 3D rendering, orthographic camera, custom buffer geometry
- **GSAP** 3.12 — Timeline animations, easing (power3, back.out)
- **Vanilla JS** — ES Modules, Raycaster, pointer events
- **CSS** — Glassmorphism, backdrop-filter, transitions

## Architecture

```
optical-illusion/
├── index.html          ← HTML structure, CDN links
├── css/
│   └── style.css       ← All styles (glassmorphism, overlay, card, responsive)
└── js/
    ├── scene.js        ← Three.js setup, camera, renderer, geometry generation
    ├── interaction.js  ← Raycaster, click/close handlers, state management
    └── app.js          ← Render loop, per-frame updates, resize handler
```
