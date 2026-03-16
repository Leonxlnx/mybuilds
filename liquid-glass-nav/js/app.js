document.addEventListener("DOMContentLoaded", () => {
    const navButtons = document.querySelectorAll(".nav-btn");
    const activePill = document.getElementById("active-pill");
    const themeBtn = document.getElementById("theme-btn");
    const nav = document.getElementById("nav");
    const glare = document.getElementById("glare");

    // Sliding Pill Position berechnen
    function updatePill(btn, smooth = true) {
        if (!btn) return;

        if (!smooth) {
            activePill.style.transition = 'none';
        } else {
            activePill.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), background 0.5s ease, box-shadow 0.5s ease';
        }

        activePill.style.width = `${btn.offsetWidth}px`;
        activePill.style.transform = `translateX(${btn.offsetLeft}px)`;
    }

    // Initiales Laden ohne Animation
    const initialActive = document.querySelector(".nav-btn.active");
    if (initialActive) {
        setTimeout(() => {
            updatePill(initialActive, false);
            void activePill.offsetWidth;
        }, 50);
    }

    // Navigation Click Handler
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updatePill(btn);
        });
    });

    // Dark / Light Mode Toggle
    themeBtn.addEventListener("click", () => {
        const root = document.documentElement;
        const isDark = root.getAttribute("data-theme") === "dark";
        root.setAttribute("data-theme", isDark ? "light" : "dark");

        setTimeout(() => {
            const active = document.querySelector(".nav-btn.active");
            if (active) updatePill(active);
        }, 100);
    });

    // Responsive Resize
    window.addEventListener("resize", () => {
        const active = document.querySelector(".nav-btn.active");
        if (active) updatePill(active, false);
    });

    // Interaktiver Liquid Glare (Maus-Lichtkegel)
    nav.addEventListener("mousemove", (e) => {
        const rect = nav.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        glare.style.setProperty("--x", `${x}px`);
        glare.style.setProperty("--y", `${y}px`);
    });
});
