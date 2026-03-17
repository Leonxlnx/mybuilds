# bento-analytics

## Prompt

> Build a premium Bento Grid Analytics Dashboard — a responsive 5-card layout with interactive data visualizations, micro-animations, and a dark/light theme.
>
> **Bento Grid Layout:**
> - 3-column CSS Grid with 5 cards: Arc gauge (2-col span), Unique Visits sparkline, Today sparkline, Countries list, 3D Globe
> - Staggered entry animations (`slideUp`) with increasing delays per card
> - Cards have rounded corners (28px), subtle shadows, and hover lift effects
>
> **Interactive Glow System:**
> - Static base glow: light blue radial gradient at top of each card
> - Dynamic mouse glow: 400px radial gradient that follows cursor position inside each card
> - Both glows use CSS variables for seamless dark/light mode transitions
>
> **Data Visualizations:**
> - **Arc Chart:** Mathematically precise SVG half-circle gauge with 4 segments (Instagram, YouTube, Negozio, TikTok), rounded linecaps, animated draw-in, hover tooltips with platform icons
> - **Area Sparklines:** SVG paths with `stroke-dashoffset` draw animation and gradient fill fade-in
> - **Countries List:** Dynamically injected with animated slide-in, progress bars, and count-up numbers
> - **3D Globe:** D3.js orthographic projection with TopoJSON world data, highlighted countries, auto-rotation, and drag interaction
>
> **Micro-Animations:**
> - Count-up numbers with `easeOutExpo` easing
> - Line draw animations via `stroke-dasharray`/`stroke-dashoffset`
> - Spring-curve hover tooltips with scale transitions
> - Country list staggered `slideRight` entry
>
> **Theme System:**
> - Full dark/light mode via CSS variables with `localStorage` persistence
> - Respects `prefers-color-scheme` system preference
> - Animated theme toggle button with rotation

## Tech Stack

- **HTML/CSS/JS** — Core structure and logic
- **D3.js v7** — 3D globe orthographic projection
- **TopoJSON** — World map data (countries-110m)
- **Google Fonts** — Inter (400–800)
- **SVG** — Arc chart, sparklines, inline icons

## Architecture

```
bento-analytics/
├── index.html        ← HTML structure, SVG charts, card layout
├── css/
│   └── style.css     ← Theme variables, bento grid, card styles, animations
├── js/
│   └── app.js        ← Dark mode, glow tracking, counters, arc chart, globe
└── prompt.md         ← This file
```
