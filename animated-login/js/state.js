/* ==========================================
   STATE MANAGEMENT
   Zentrale State-Maschine für alle UI-Zustände
   ========================================== */

export const state = {
    focus: 'none',         // 'none' | 'email' | 'password'
    passwordVisible: false
};

/**
 * Aktualisiert die Body-CSS-Klassen und Eye-Tracking-Ziele
 * basierend auf dem aktuellen State.
 * @param {object} eyeTarget - Referenz zum Eye-Tracking Target { x, y }
 * @param {object} mouseNorm - Aktuelle normalisierte Mausposition { x, y }
 */
export function updateState(eyeTarget, mouseNorm) {
    // Nur Focus-Klassen entfernen, NICHT loaded/login-success/login-fail
    document.body.classList.remove('focus-email', 'focus-password-visible', 'focus-password-hidden');
    
    if (state.focus === 'email') {
        document.body.classList.add('focus-email');
        eyeTarget.x = 1;      // Alle gucken stark nach rechts
        eyeTarget.y = 0.2;    // Minimal nach unten (Richtung Formular)
    
    } else if (state.focus === 'password') {
        if (state.passwordVisible) {
            document.body.classList.add('focus-password-visible');
            eyeTarget.x = 1;   // Neugierig auf das Passwort gucken
            eyeTarget.y = 0.1;
        } else {
            document.body.classList.add('focus-password-hidden');
            eyeTarget.x = -1;  // Diskret wegschauen
            eyeTarget.y = 0.8;
        }
    } else {
        // Idle – echte Mausposition übernehmen
        eyeTarget.x = mouseNorm.x;
        eyeTarget.y = mouseNorm.y;
    }
}
