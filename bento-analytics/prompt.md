# bento-analytics

## Prompt

Act as an elite UI/UX Frontend Engineer specializing in data visualization and premium micro-interactions. Your task is to build a pixel-perfect, ultra-clean "Bento Grid" analytics dashboard.

You must output the entire solution in a **single `index.html` file** containing vanilla HTML, pure CSS, and vanilla JavaScript. Do not use any frontend frameworks (like React, Vue, or Tailwind). You may only use D3.js (v7) and TopoJSON via CDN for the interactive globe, and Google Fonts ('Inter').

**CRITICAL CONSTRAINT:** The design must be STRICTLY LIGHT MODE ONLY. Do not include any dark mode toggles, CSS variables for dark themes, or `prefers-color-scheme` media queries. The aesthetic must be extremely clean, bright, minimal, and highly professional, comparable to Apple or Vercel's design language.

### 1. Global Layout & Design System
- **Background:** Very light gray (`#FAFAFA`).
- **Typography:** 'Inter' font (weights 400, 500, 600, 700, 800). Main text: `#0F172A`, Muted text/labels: `#64748B` (uppercase with letter-spacing for subtitles).
- **Grid Container:** Centered vertically and horizontally (`min-height: 100vh`), max-width 1050px, CSS Grid with 3 equal columns (`repeat(3, 1fr)`), 24px gap. Responsive (2 cols on tablet, 1 col on mobile).
- **Cards:** White background (`#FFFFFF`), 28px border-radius, 32px padding, 1px solid border (`#E2E8F0`), and a very soft shadow (`0 10px 40px -10px rgba(0,0,0,0.04)`).
- **Card Hover:** Cards lift slightly (`translateY(-5px)`), shadow deepens (`0 20px 40px -10px rgba(0,0,0,0.08)`), and border subtly tints light blue (`rgba(59, 130, 246, 0.3)`). Transition should be smooth (`0.3s ease`).
- **Entry Animation:** On load, all cards must stagger-animate into view (fade in from `opacity: 0` and slide up `translateY: 30px` to `0`) using a premium easing curve `cubic-bezier(0.16, 1, 0.3, 1)`.

### 2. The Signature Interaction: "Mouse-Follow Glow"
Every single card must have a relative container with `overflow: hidden`, housing two absolute-positioned, pure CSS radial gradients placed behind the content (`z-index: 0`, `pointer-events: none`):
1. **Static Base Glow:** A static, extremely faint radial gradient centered at the top center (`radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.03) 0%, transparent 60%)`).
2. **Mouse-Tracking Glow:** A dynamic 400x400px radial gradient (`rgba(59, 130, 246, 0.08)`) that exactly tracks the user's cursor coordinates (`X` and `Y` relative to the card) using a `mousemove` event listener and `getBoundingClientRect()`. It should smoothly fade in (`opacity: 1`) on hover and fade out on mouseleave.

### 3. Card Breakdown (5 Cards Total)

**Card 1 (Top Left, spans 2 columns): The Interactive Arc Chart**
- Create a mathematical half-donut gauge chart using inline SVG `<path>` elements. **Do not use a charting library.**
- Data: Instagram (150, Orange `#FF8A65`), YouTube (120, Yellow `#FFB74D`), Negozio (100, Green `#4ADE80`), TikTok (77, Blue `#60A5FA`). Total: 447.
- **Logic:** Use JavaScript to calculate the exact `d` path attributes using trigonometry (radius 145, stroke-width 28). Implement a visual gap of 3.5 degrees between segments. Account for rounded `stroke-linecap: round` overhang so paths don't overlap visually.
- **Center Text:** Large animated number "447" and "Tot Clicks" label absolutely positioned inside the arc.
- **Animations:** Paths must draw themselves on load via `stroke-dasharray` and `stroke-dashoffset`.
- **Interactions:** On hover over a path segment, smoothly increase its `stroke-width` to 34, drop opacity of other paths to 0.25, and add a drop-shadow.
- **Tooltip:** A custom absolute HTML tooltip (`position: fixed`) must follow the mouse cursor over the arcs, displaying the specific segment's SVG icon (with matching background color), value, and name.

**Cards 2 & 3 (Top Right & Bottom Left, 1 column each): Area Sparklines**
- Card 2: Subtitle "UNIQUE VISITS", Value: "84.2K", Badge: "+24%".
- Card 3: Subtitle "TODAY", Value: "7.2K", Badge: "+14%".
- **Badges:** Light green background (`#DCFCE7`), dark green text (`#16A34A`), pill-shaped, with a tiny upward trend SVG icon.
- **Charts:** A bottom-aligned SVG area chart spanning the full card width (use negative horizontal margins to make it touch the edges). Use a smooth bezier curve. The green stroke line (`#10B981`, width 3.5) must draw itself left-to-right on load (`stroke-dasharray` animation). The area below the line needs a vertical linear gradient (25% green opacity to transparent) that fades in after the line draws.

**Card 4 (Bottom Middle, 1 column): Countries Progress List**
- Title: "COUNTRIES".
- Vertical list of 5 rows: USA (214, 28%), Italy (167, 22%), UK (133, 18%), Germany (126, 17%), France (118, 16%).
- Layout per row: Emoji flag, bold Country Name, animated exact value, a horizontal progress bar (gray track `#E2E8F0`, dark muted fill `#64748B`), and percentage text.
- **Animations:** Staggered horizontal slide-in (`translateX`) for the rows. Progress bar fills must dynamically animate their width from 0% to their target % over 1.5s. On hover, translate the row slightly right (`6px`).

**Card 5 (Bottom Right, 1 column, 0px padding): 3D Interactive Globe**
- Remove card padding so the globe fills the container.
- Render an interactive 3D orthographic globe using `D3.js` and `topojson-client` (e.g., `https://unpkg.com/world-atlas@2.0.2/countries-110m.json`).
- Colors: Transparent ocean, light gray land (`#E2E8F0`), white borders (`#FFFFFF`, stroke-width 0.5).
- **Highlights:** Specifically highlight the 5 countries from Card 4 (USA, Italy, UK, Germany, France) in solid blue (`#3B82F6`) using their TopoJSON IDs.
- **Interactions:** Set the initial projection to focus exactly on the EMEA region (Europe/Africa). The globe must auto-rotate slowly on the Y-axis. The user must also be able to grab and drag to rotate it manually using `d3.drag()`.

### 4. Global JavaScript Micro-Animations
- Write a highly optimized `requestAnimationFrame` counting function. All large numbers and country values must animate counting up from 0 to their target values over 2000ms using an `easeOutExpo` function.
- Combine all HTML, CSS, and JS beautifully. Pay fanatical attention to spacing, typography weights, and animation timings. Output ONLY the complete code block.

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
