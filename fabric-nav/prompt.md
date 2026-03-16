# fabric-nav

## Prompt

> Create an ultra-clean "Fabric Navigation" bar — a neumorphic pill-shaped nav that simulates a physical textile/fabric material you can press, dent, and stretch.
>
> **Material Simulation:**
> - Diagonal woven thread array via repeating CSS gradients (45° / -45°)
> - Organic fractal noise texture via inline SVG `feTurbulence` filter
> - Dynamic denting shadow that tracks the pointer position using CSS variables
> - Deep neumorphic multi-layer `box-shadow` (outer light/dark + inner highlights)
>
> **Spring Physics Engine:**
> - Custom `Spring` class with configurable tension & friction
> - 3D container tilt (`rotateX` / `rotateY`) tracking the pointer
> - Per-element cloth tension: adjacent icons get pulled toward the press point
> - Active button squishes deep (`scale(0.82)`) simulating fabric indentation
> - All animations run at 60fps via `requestAnimationFrame`
>
> **Navigation:**
> - 3 icon buttons: Home, Messages, Profile (SVG stroke icons)
> - Active state with spring-animated under-dot indicator
> - Vertical seam divider + Dark/Light theme toggle (Sun/Moon cross-fade)
>
> **Interactions:**
> - Hover: gentle ambient 3D tilt
> - Press & drag: deep fabric dent, heavy tilt, material stretching physics
> - Release: spring-back to resting state with overshoot
> - `setPointerCapture` for seamless drag outside boundaries

## Tech Stack

- **Vanilla HTML/CSS/JS** — Zero dependencies
- **CSS Custom Properties** — Theming (light linen / dark velvet)
- **SVG `feTurbulence`** — Procedural fabric noise texture
- **Custom Spring Physics** — Tension/friction-based animation system
- **`requestAnimationFrame`** — 60fps render loop

## Architecture

```
fabric-nav/
├── index.html        ← HTML structure + SVG icons
├── css/
│   └── style.css     ← Theme variables, neumorphic shadows, fabric textures
├── js/
│   └── app.js        ← Spring physics engine, 3D tilt, denting, interactions
└── prompt.md         ← This file
```
