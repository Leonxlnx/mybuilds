document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DARK MODE TOGGLE ---
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        body.classList.add('dark');
    }

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark');
        localStorage.theme = body.classList.contains('dark') ? 'dark' : 'light';
    });

    // --- 2. INTERACTIVE MOUSE GLOW ---
    document.querySelectorAll('.card').forEach(card => {
        const mouseGlow = card.querySelector('.glow-mouse');
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            mouseGlow.style.left = `${e.clientX - rect.left}px`;
            mouseGlow.style.top = `${e.clientY - rect.top}px`;
        });
    });

    // --- 3. COUNT-UP MICROANIMATIONS ---
    const initCounters = () => {
        document.querySelectorAll('.counter').forEach(el => {
            const target = parseFloat(el.getAttribute('data-target'));
            const decimals = parseInt(el.getAttribute('data-decimals')) || 0;
            const duration = 2000;
            let start = null;

            const step = timestamp => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                const current = easeOut * target;

                el.innerText = current.toFixed(decimals);
                if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    };
    setTimeout(initCounters, 300);

    // --- 4. INJECT COUNTRIES & ANIMATE PROGRESS BARS ---
    const countries = [
        { flag: '🇺🇸', name: 'United States', val: 214, pct: 28 },
        { flag: '🇮🇹', name: 'Italy', val: 167, pct: 22 },
        { flag: '🇬🇧', name: 'United Kingdom', val: 133, pct: 18 },
        { flag: '🇩🇪', name: 'Germany', val: 126, pct: 17 },
        { flag: '🇫🇷', name: 'France', val: 118, pct: 16 }
    ];
    const countryList = document.getElementById('country-list');
    countries.forEach((c, i) => {
        const item = document.createElement('div');
        item.className = 'country-item';
        item.style.animationDelay = `${0.6 + i * 0.1}s`;
        item.innerHTML = `
            <div class="c-flag">${c.flag}</div>
            <div class="c-name">${c.name}</div>
            <div class="c-val counter" data-target="${c.val}">0</div>
            <div class="c-bar-bg"><div class="c-bar-fill" data-width="${c.pct}%"></div></div>
            <div class="c-pct">${c.pct}%</div>
        `;
        countryList.appendChild(item);
    });
    setTimeout(() => {
        document.querySelectorAll('.c-bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-width');
        });
    }, 800);

    // --- 5. MATHEMATICALLY PERFECT ARC CHART ---
    const arcData = [
        { val: 150, color: 'var(--chart-insta)', label: 'Instagram', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>' },
        { val: 120, color: 'var(--chart-yt)', label: 'YouTube', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>' },
        { val: 100, color: 'var(--chart-negozio)', label: 'Negozio', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>' },
        { val: 77, color: 'var(--chart-tiktok)', label: 'TikTok', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>' }
    ];

    const arcSvg = document.getElementById('arc-chart');
    const tooltip = document.getElementById('chart-tooltip');
    const ttIcon = document.getElementById('tt-icon');
    const ttVal = document.getElementById('tt-val');
    const ttLbl = document.getElementById('tt-lbl');

    const cx = 200, cy = 200, radius = 145, strokeW = 28;
    const totalVal = 447;
    const visualGap = 3.5;

    const capAngle = (strokeW / 2 / (Math.PI * radius)) * 180;
    const availableAngle = 180 - (arcData.length - 1) * visualGap;
    let currentStart = capAngle;

    function getCoords(angle) {
        const rad = (angle - 180) * Math.PI / 180;
        return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    }

    arcData.forEach((d, i) => {
        const segmentAngle = (d.val / totalVal) * availableAngle;
        const currentEnd = currentStart + segmentAngle - (capAngle * 2);

        if (currentEnd > currentStart) {
            const startPos = getCoords(currentStart);
            const endPos = getCoords(currentEnd);
            const largeArc = currentEnd - currentStart <= 180 ? "0" : "1";

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${startPos.x} ${startPos.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPos.x} ${endPos.y}`);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", d.color);
            path.setAttribute("stroke-width", strokeW);
            path.setAttribute("stroke-linecap", "round");
            path.classList.add("arc-path");

            const pathLength = radius * (currentEnd - currentStart) * Math.PI / 180;
            path.style.strokeDasharray = pathLength;
            path.style.strokeDashoffset = pathLength;

            path.addEventListener("mouseenter", () => {
                document.querySelectorAll(".arc-path").forEach(p => p.style.opacity = "0.25");
                path.style.opacity = "1";
                tooltip.classList.add("active");
                ttIcon.innerHTML = d.icon;

                const rawColor = getComputedStyle(document.body).getPropertyValue(d.color.replace('var(', '').replace(')', '')).trim();
                ttIcon.style.backgroundColor = rawColor || d.color;

                ttVal.innerText = d.val;
                ttLbl.innerText = d.label;
            });

            path.addEventListener("mousemove", e => {
                tooltip.style.left = e.clientX + "px";
                tooltip.style.top = e.clientY + "px";
            });

            path.addEventListener("mouseleave", () => {
                document.querySelectorAll(".arc-path").forEach(p => p.style.opacity = "1");
                tooltip.classList.remove("active");
            });

            arcSvg.appendChild(path);

            setTimeout(() => {
                path.style.strokeDashoffset = 0;
            }, 500 + i * 150);
        }
        currentStart += segmentAngle + visualGap;
    });

    // --- 6. D3.js 3D GLOBE ---
    const renderGlobe = () => {
        const container = document.getElementById('globe-canvas');
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 300;

        const svg = d3.select("#globe-canvas").append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("overflow", "visible");

        const projection = d3.geoOrthographic()
            .scale(width / 1.8)
            .translate([width / 2, height / 2])
            .clipAngle(90);

        const path = d3.geoPath().projection(projection);

        d3.json("https://unpkg.com/world-atlas@2.0.2/countries-110m.json").then(world => {
            const countries = topojson.feature(world, world.objects.countries).features;

            const highlights = ["840", "380", "826", "276", "250"];

            const paths = svg.selectAll("path.country")
                .data(countries).enter().append("path")
                .attr("class", "country")
                .attr("d", path)
                .style("fill", d => highlights.includes(d.id) ? "var(--globe-highlight)" : "var(--globe-land)")
                .style("stroke", "var(--globe-border)")
                .style("stroke-width", "0.5")
                .style("transition", "fill var(--transition), stroke var(--transition)");

            let rotation = [-15, -20];
            d3.timer(elapsed => {
                projection.rotate([rotation[0] + elapsed * 0.005, rotation[1]]);
                paths.attr("d", path);
            });

            let isDragging = false;
            let startX;
            svg.call(d3.drag()
                .on("start", e => { isDragging = true; startX = e.x; })
                .on("drag", e => {
                    if (isDragging) {
                        rotation[0] += (e.x - startX) * 0.5;
                        startX = e.x;
                    }
                })
                .on("end", () => { isDragging = false; })
            );
        });
    };

    setTimeout(renderGlobe, 600);
});
