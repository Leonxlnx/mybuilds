/* ==========================================
   EYE TRACKING + BODY DISTORTION ENGINE
   Physik-basiertes Lerping für weiche Bewegung
   ========================================== */

// Aktuelle interpolierte Position
let currentX = 0;
let currentY = 0;

// Zielposition (wird extern gesetzt)
export const eyeTarget = { x: 0, y: 0 };

// Normalisierte Mausposition (-1 bis 1)
export const mouseNorm = { x: 0, y: 0 };

/**
 * Globale Maus-Tracking Initialisierung
 * Erfasst die Mausposition und normalisiert sie.
 */
export function initMouseTracking() {
    document.addEventListener('mousemove', (e) => {
        mouseNorm.x = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseNorm.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });
}

/**
 * Animations-Loop für physikalisch weiches Eye-Tracking (60fps).
 * Nutzt Linear Interpolation (Lerping) mit 15% pro Frame
 * für gewichtete, natürliche Augenbewegungen.
 * Setzt auch Body-Distortion Werte.
 */
export function startEyeAnimationLoop() {
    function animate() {
        // Lerping: 15% Annäherung pro Frame → weiches, gewichtetes Tracking
        currentX += (mouseNorm.x - currentX) * 0.08;
        currentY += (mouseNorm.y - currentY) * 0.08;
        
        // CSS Custom Properties aktualisieren
        document.documentElement.style.setProperty('--mx', currentX);
        document.documentElement.style.setProperty('--my', currentY);
        
        requestAnimationFrame(animate);
    }
    
    animate();
}
