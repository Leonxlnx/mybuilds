You are an expert frontend engineer specializing in SVG animation, CSS physics, and interactive micro-interactions. Build a two-panel animated login page where four SVG characters react in real-time to the user's mouse position and form interactions. The characters have smooth eye-tracking, body distortion, contextual facial expressions, and elaborate entry/exit animations. The project is a single static HTML page with modular CSS and ES module JavaScript — no build tools required.


# 1. PROJECT STRUCTURE

The project uses plain HTML, CSS, and JavaScript (ES Modules). No frameworks, no bundlers.

File structure:
- `index.html` — full markup with inline SVG characters and the login form
- `css/variables.css` — design tokens
- `css/base.css` — box-sizing, font, body flex layout
- `css/layout.css` — left/right panel positioning, background images, overlays
- `css/characters.css` — SVG character transforms, face state transitions, interaction states, success/fail animations
- `css/animations.css` — keyframe definitions for entry animations, breathing, blinking, form slide-in
- `css/form.css` — input styling, buttons, checkbox, typography
- `css/responsive.css` — mobile breakpoints
- `js/app.js` — module entry point, initializes all systems
- `js/state.js` — central state machine
- `js/eye-tracking.js` — mouse normalization + animation loop
- `js/form-interactions.js` — form events, login validation, success/fail triggers
- `js/dotshift.js` — placeholder module (background handled via CSS)
- `img/bg-chars.webp` — left panel background image (abstract colorful pattern)
- `img/bg-login.webp` — right panel background image (soft gradient)

Font: Plus Jakarta Sans (400, 500, 600, 700) from Google Fonts.


# 2. LAYOUT

Two-panel horizontal layout with 16px body padding and 16px gap:

- Left panel: flex 1.2, border-radius 24px, background image with 25% white overlay (rgba(255,255,255,0.25)), holds the SVG characters centered
- Right panel: flex 1, max-width 560px, border-radius 24px, background image with 82% white overlay + backdrop-filter blur(2px), box-shadow 0 4px 24px rgba(0,0,0,0.06), holds the login form (max-width 360px)


# 3. DESIGN TOKENS

- --bg-left: #F5F3F7
- --bg-right: #FFFFFF
- --text-main: #111111
- --text-muted: #71717A
- --border: #E4E4E7
- --c-purple: #6B21FF
- --c-yellow: #F4D03F
- --c-black: #1A1A1A
- --c-orange: #FF7443


# 4. SVG CHARACTERS

Four characters inside a single SVG (viewBox="0 0 450 400", overflow visible):

Character 1 — Purple (tall pill, left side):
- Shape: rect at (55, 55), width 110, height 300, rx 40, fill var(--c-purple)
- Eyes: white circles r=12 at cx=85/135, cy=120, with black pupils r=5
- Mouth: curved path (smile), stroke #FFF, width 3
- Entry animation: growUp (1.4s, cubic-bezier 0.34,1.56,0.64,1), delay 0.35s

Character 2 — Black (medium pill, center):
- Shape: rect at (188, 150), width 88, height 205, rx 44, fill var(--c-black), clipped to prevent overflow at top
- Eyes: white circles r=10 at cx=214/250, cy=200, with black pupils r=4.5
- Entry animation: portalOpen (1.4s, drop from -250px with multi-stage bounce squash), delay 0.2s

Character 3 — Yellow (dome shape, right):
- Shape: SVG arc path creating a dome from (255,390) to (435,390), fill var(--c-yellow)
- Eyes: black dot pupils r=6 at cx=320/370, cy=300 (no white sclera — dark eyes on light body)
- Entry animation: jellyBlobUp (1.8s, starts squished flat then bounces up), delay 0.4s

Character 4 — Orange (large dome, foreground):
- Shape: SVG arc path creating a wide dome from (10,390) to (320,390), fill var(--c-orange)
- Eyes: black dot pupils r=6 at cx=130/200, cy=310 (no white sclera)
- Entry animation: jellyBlobUp (1.8s), delay 0.05s

Each character has exactly 4 face states (each a separate SVG group):
- face-default: normal expression with eye-tracking pupils, gentle smile
- face-hidden: closed eyes (horizontal lines), wavy/flat mouth — used when password is hidden
- face-visible: wide-open eyes (larger radius), surprised "O" mouth — used when password is visible
- face-happy: upward curved eye arcs (closed happy eyes), big open smile — used on login success


# 5. EYE TRACKING ENGINE

Mouse position is normalized to [-1, 1] range:
- mouseNorm.x = (clientX / innerWidth - 0.5) * 2
- mouseNorm.y = (clientY / innerHeight - 0.5) * 2

Smooth interpolation via requestAnimationFrame loop:
- Linear interpolation factor: 0.08 per frame (very smooth, weighted movement)
- currentX += (targetX - currentX) * 0.08
- currentY += (targetY - currentY) * 0.08

Output is written to CSS custom properties `--mx` and `--my` on the document root.

Pupil movement via CSS:
- `.eye-tracker { transform: translate(calc(var(--mx) * 5px), calc(var(--my) * 3px)) }`
- Pupil transition: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)


# 6. BODY DISTORTION

Each character body distorts toward the mouse position using CSS transforms. The transform-origin is always bottom center so the base stays fixed while the body leans:

- Purple: skewX(--mx * -5deg) scaleY(1 + --my * -0.04)
- Black: skewX(--mx * -4deg) scaleY(1 + --my * -0.03)
- Orange: skewX(--mx * -4deg) scaleY(1 + --my * -0.03)
- Yellow: skewX(--mx * 3deg) scaleY(1 + --my * -0.03) — leans opposite direction

Character body transition: 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)


# 7. STATE MACHINE

Three focus states: 'none', 'email', 'password' (+ passwordVisible boolean).

Email focus:
- All characters lean hard right toward the form: Purple skewX(-12deg) scaleY(1.04), Black skewX(-8deg) scaleY(1.05), Yellow skewX(-6deg) scaleY(1.02), Orange skewX(-6deg) scaleY(1.03)
- Eye target forced to x=1, y=0.2

Password hidden:
- All characters lean left, looking away: Purple skewX(12deg) scaleY(0.95), Black skewX(8deg) scaleY(0.88), Yellow skewX(10deg) scaleY(0.95), Orange skewX(6deg) scaleY(0.92)
- face-hidden activated (closed eyes, flat mouth)
- Faces shift left by translateX(-8px)
- Eye target forced to x=-1, y=0.8

Password visible:
- All characters lean extremely hard right, curious: Purple skewX(-18deg) scaleY(1.08), Black skewX(-14deg) scaleY(1.1), Yellow skewX(-10deg) scaleY(1.06), Orange skewX(-12deg) scaleY(1.07)
- face-visible activated (wide eyes, open mouth)
- Eye tracker override: translate(10px, -2px) !important
- Pupils scale to 1.5x (dilated with curiosity)

Idle (none):
- Eye target follows actual mouse position
- face-default active
- Body follows mouse distortion


# 8. ENTRY ANIMATIONS

Three distinct character entrance styles, all using transform-box: fill-box and transform-origin: bottom center:

growUp (Purple): 1.4s, starts at scaleY(0) scaleX(1.2), grows upward with overshoot via cubic-bezier(0.34, 1.56, 0.64, 1)

portalOpen (Black): 1.4s, drops from translateY(-250px) scale(0), lands at 42%, then 4-stage bounce squash sequence (scaleY 0.78→1.08→0.93→1.03→0.99→1.0)

jellyBlobUp (Orange, Yellow): 1.8s, starts at scaleY(0.02) scaleX(1.4), grows up with 3-stage jelly overshoot (1.15→0.88→1.05→0.97→1.0)

Breathing: infinite 4s ease-in-out cycle, scaleY(1) → scaleY(1.02) translateY(-2px) → back. Staggered delays per character (0s, 0.5s, 1s, 1.5s).

Eye blink: infinite 4.5s cycle, scaleY drops to 0.1 at 98% then returns. Staggered delays (0s, 0.8s, 1.5s, 3s).


# 9. FORM INTERACTIONS

Login form elements slide in from right with staggered delays (0.4s to 0.75s in 0.05s increments):
- Animation: 0.8s cubic-bezier(0.16, 1, 0.3, 1), translateX(30px) → translateX(0)

Form elements:
- Star logo SVG (32x32px, centered, #111 fill)
- H1: "Welcome back!" — 32px, letter-spacing -0.5px
- Subtitle: "Please enter your details" — 15px, muted color
- Email input with label
- Password input with eye toggle button (SVG icon switches between open/closed states)
- Options row: custom checkbox "Remember for 30 days" + "Forgot password?" link
- Primary button "Log In": background #111, white text, hover lifts -2px with shadow
- Google button with full-color Google SVG logo, semi-transparent background
- "Don't have an account? Sign Up" link

Input styling: padding 14px 16px, border-radius 12px, border 1.5px solid rgba(0,0,0,0.2), focus adds 3px ring rgba(17,17,17,0.1)

Eye toggle prevents blur on mousedown (e.preventDefault()) to maintain password focus state.


# 10. LOGIN SUCCESS SEQUENCE

Triggered when email = "test@gmail.com" and password = "123456".

Phase 1 (0ms): body gets class 'login-success'
- All characters switch to face-happy (closed happy eyes, big smile)
- Characters bounce down with staggered delays (0.1s, 0.2s, 0.3s, 0.4s)
- bounceDown keyframe: 0.8s, starts normal → scaleY(1.15) translateY(-20px) → squash to scaleY(0.8) → slide down to translateY(250%) with opacity 0

Phase 2 (1000ms): 3 color splash circles spawn simultaneously
- Positioned at: (15%vw, 35%vh), (50%vw, 60%vh), (80%vw, 30%vh)
- Colors: #A7F3D0 (Mint), #C4B5FD (Lavender), #FECDD3 (Soft Peach)
- Size: Math.max(vw, vh) * 3 (covers full viewport)
- Animation: splashGrow 1.4s cubic-bezier(0.22, 1, 0.36, 1) — scale(0) → scale(1)
- z-index: 9999

Phase 3 (2800ms): White wipe overlay
- Full-screen div, background #fff, z-index 10000
- Sweeps from translateX(-100%) → translateX(0%) in 1.0s cubic-bezier(0.4, 0, 0.2, 1)
- Page stays white permanently


# 11. LOGIN FAIL

Triggered on incorrect credentials:
- body gets class 'login-fail' for 800ms
- Characters play charShake: 0.15s ease-in-out, 4 repetitions, translateX ±6px
- Characters compress: Purple scaleY(0.9), Black scaleY(0.85), Yellow scaleY(0.9), Orange scaleY(0.88)
- face-hidden activated (annoyed closed eyes)
- After 800ms, class removed and characters return to default state


# 12. PERFORMANCE

- All animated elements use will-change: transform, opacity
- GPU-accelerated transforms only (no layout triggers)
- CSS custom properties for eye tracking (no per-element style writes)
- Single requestAnimationFrame loop for all character movement
- Face state transitions use CSS opacity 0.3s (no JavaScript DOM manipulation per frame)

Build this as a complete, working static HTML project. The result should be a polished, interactive login form where four expressive characters watch, react, and celebrate alongside the user. Every interaction should feel smooth, weighted, and alive.
