/* ==========================================
   FORM INTERACTIONS
   Event-Listener für Email, Password & Eye Toggle
   + Login Validation + Clean Success Animation
   ========================================== */

import { state, updateState } from './state.js';
import { eyeTarget, mouseNorm } from './eye-tracking.js';

/**
 * Initialisiert alle Form-Event-Listener.
 */
export function initFormInteractions() {
    const emailInput    = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const eyeIconBtn    = document.getElementById('eye-toggle');
    const openPaths     = document.querySelectorAll('.eye-open');
    const closedPaths   = document.querySelectorAll('.eye-closed');
    const form          = document.querySelector('form');

    // --- Email Focus/Blur ---
    emailInput.addEventListener('focus', () => {
        state.focus = 'email';
        updateState(eyeTarget, mouseNorm);
    });
    emailInput.addEventListener('blur', () => {
        state.focus = 'none';
        updateState(eyeTarget, mouseNorm);
    });

    // --- Password Focus/Blur ---
    passwordInput.addEventListener('focus', () => {
        state.focus = 'password';
        updateState(eyeTarget, mouseNorm);
    });
    passwordInput.addEventListener('blur', () => {
        state.focus = 'none';
        updateState(eyeTarget, mouseNorm);
    });

    // Verhindert Blur beim Klick auf das Eye-Icon
    eyeIconBtn.addEventListener('mousedown', (e) => e.preventDefault());

    // --- Eye Toggle (Passwort sichtbar/versteckt) ---
    eyeIconBtn.addEventListener('click', () => {
        state.passwordVisible = !state.passwordVisible;
        passwordInput.type = state.passwordVisible ? 'text' : 'password';
        
        openPaths.forEach(p => p.style.display = state.passwordVisible ? 'none' : 'block');
        closedPaths.forEach(p => p.style.display = state.passwordVisible ? 'block' : 'none');
        
        updateState(eyeTarget, mouseNorm);
    });

    // --- Login Submit ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (email === 'test@gmail.com' && password === '123456') {
            triggerSuccess();
        } else {
            triggerFail();
        }
    });
}

/* ==========================================
   SUCCESS – Bounce Down → 2 Color Splashes → White Wipe
   ========================================== */

function triggerSuccess() {
    document.body.classList.add('login-success');
    
    // Phase 2: 3 pastel color splashes gleichzeitig (nach chars bounce)
    setTimeout(() => {
        spawnColorSplashes();
    }, 1000);
    
    // Phase 3: White wipe left → right (langsamer)
    setTimeout(() => {
        const wipe = document.createElement('div');
        wipe.className = 'white-wipe';
        document.body.appendChild(wipe);
        
        requestAnimationFrame(() => {
            wipe.classList.add('sweep');
        });
        
        // Seite bleibt weiß
    }, 2800);
}

function spawnColorSplashes() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const size = Math.max(vw, vh) * 3;

    // 3 cleane Pastelfarben – alle gleichzeitig
    const splashes = [
        { x: vw * 0.15, y: vh * 0.35, color: '#A7F3D0' },  // Mint
        { x: vw * 0.5,  y: vh * 0.6,  color: '#C4B5FD' },  // Lavender
        { x: vw * 0.8,  y: vh * 0.3,  color: '#FECDD3' },  // Soft Peach
    ];

    splashes.forEach(({ x, y, color }) => {
        const el = document.createElement('div');
        el.className = 'color-splash';
        el.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x - size / 2}px;
            top: ${y - size / 2}px;
            background: ${color};
        `;
        document.body.appendChild(el);
        
        // Alle gleichzeitig
        requestAnimationFrame(() => el.classList.add('pop'));
    });
}

/* ==========================================
   FAIL – Shake
   ========================================== */
function triggerFail() {
    document.body.classList.add('login-fail');
    
    setTimeout(() => {
        document.body.classList.remove('login-fail');
    }, 800);
}
