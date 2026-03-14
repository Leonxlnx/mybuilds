/* ==========================================
   APP ENTRY POINT
   Initialisiert alle Module beim Laden
   ========================================== */

import { initMouseTracking, startEyeAnimationLoop } from './eye-tracking.js';
import { initFormInteractions } from './form-interactions.js';
import { initDotShift } from './dotshift.js';

// Alles initialisieren
initMouseTracking();
initFormInteractions();
startEyeAnimationLoop();
initDotShift();

// Smooth page reveal (verhindert schwarzen Flash)
requestAnimationFrame(() => {
    document.body.classList.add('loaded');
});

console.log('✨ Animated Login initialized');
