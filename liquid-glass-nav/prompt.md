# liquid-glass-nav

## Prompt

> Act as an Elite UI/UX Front-End Engineer specializing in Apple-tier micro-interactions and advanced CSS. Program a perfectly centered navigation bar with a "True Liquid Glass" aesthetic.
>
> **Design Concept — "True Liquid Glass":**
> NOT standard flat glassmorphism. A physically accurate liquid glass aesthetic combining the high-gloss specular highlights of classic macOS Aqua with volumetric spatial depth of Apple VisionOS.
>
> **The Liquid Glass Material:**
> - Deep Refraction: `backdrop-filter` with extreme blur (50px) and over-saturation (200%)
> - Specular Highlight: Curved semi-transparent white gradient on top half via `::before` pseudo-element
> - Caustics & Volume: Multi-layered inner/outer `box-shadow` for light refraction simulation
> - Interactive Glare: Radial-gradient spotlight tracking cursor via CSS variables and `mix-blend-mode: overlay`
>
> **Navigation:**
> - Pill-shaped nav bar centered in viewport
> - 3 items with SVG stroke icons: "Home", "Call", "List"
> - Vertical divider + Dark/Light Mode toggle (Sun/Moon)
>
> **Animations — "Apple Magic":**
> - Sliding Active Pill with spring physics: `cubic-bezier(0.34, 1.2, 0.64, 1)`
> - Tactile press feedback: `scale(0.92)` on `:active`
> - Sun/Moon cross-fade with rotation on theme switch
>
> **Background Environment:**
> - Animated mesh gradient with 3 large blurred floating color blobs
> - Full Dark/Light mode via CSS variables with seamless transitions

## Tech Stack

- **Vanilla HTML/CSS/JS** — Zero dependencies
- **CSS Custom Properties** — Theming (light/dark)
- **CSS `backdrop-filter`** — Glass refraction
- **CSS `mix-blend-mode`** — Interactive glare
- **Inline SVG** — Icons (Home, Call, List, Sun, Moon)

## Architecture

```
liquid-glass-nav/
├── index.html        ← HTML structure + SVG icons
├── css/
│   └── style.css     ← Theme variables, glass material, animations
├── js/
│   └── app.js        ← Sliding pill, theme toggle, glare tracking
└── prompt.md         ← This file
```
