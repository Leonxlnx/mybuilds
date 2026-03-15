// --- Vertex Shader ---
// A simple full-screen quad to host our raymarching engine
export const vertexShader = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

// --- Fragment Shader ---
// High-performance 3D Raymarching Engine with Isometric Pixel Art Shading
export const fragmentShader = `
    precision highp float;
    uniform float u_time;
    uniform vec2 u_resolution;

    // 2D Rotation Helper
    mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    // Globals to trap the exact local hit coordinates for texturing
    vec3 mapPos;
    vec3 sparklePos;

    // Mathematical formulation of the Gemini Star volume
    float sdGemini3D(vec3 p) {
        vec2 p2 = abs(p.xy);
        
        // Boolean subtraction: Flat Box minus 4 Cylinders forms the perfect Astroid
        float C = 1.25;
        float R = sqrt(1.625); // Exact radius so the tips land perfectly at 1.0
        float cyl = length(p2 - vec2(C, C)) - R;
        float box2D = max(p2.x, p2.y) - 1.05;
        float star2D = max(box2D, -cyl);
        
        // Extrude into a 3D pillowed shape with tapered edges
        float rad = length(p.xy);
        float thickness = mix(0.18, 0.03, smoothstep(0.0, 1.0, rad));
        
        vec2 w = vec2(star2D, abs(p.z) - thickness);
        // Combine with a 0.04 satisfying rounded 3D bevel
        return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.04;
    }

    // Scene mapping distance function
    float map(vec3 p) {
        vec3 pos = p;
        
        // Natural floating oscillation
        pos.y -= sin(u_time * 2.0) * 0.12;
        
        // Evaluate Orbiting Sparkles
        vec3 pSp = pos;
        pSp.xz *= rot(u_time * -0.8);
        sparklePos = pSp; 

        float dSp = 100.0;
        // Generate 4 floating octahedron gems
        vec3 sp0 = pSp - vec3( 1.5,  0.4,  0.0); sp0.y += sin(u_time * 3.0 + 0.0) * 0.15; dSp = min(dSp, (abs(sp0).x + abs(sp0).y + abs(sp0).z)*0.577 - 0.05);
        vec3 sp1 = pSp - vec3(-1.5, -0.3,  0.0); sp1.y += sin(u_time * 3.0 + 1.5) * 0.15; dSp = min(dSp, (abs(sp1).x + abs(sp1).y + abs(sp1).z)*0.577 - 0.05);
        vec3 sp2 = pSp - vec3( 0.0,  0.6,  1.5); sp2.y += sin(u_time * 3.0 + 3.0) * 0.15; dSp = min(dSp, (abs(sp2).x + abs(sp2).y + abs(sp2).z)*0.577 - 0.05);
        vec3 sp3 = pSp - vec3( 0.0, -0.5, -1.5); sp3.y += sin(u_time * 3.0 + 4.5) * 0.15; dSp = min(dSp, (abs(sp3).x + abs(sp3).y + abs(sp3).z)*0.577 - 0.05);

        // Evaluate Main Star
        pos.xy *= rot(sin(u_time * 0.8) * 0.1); // Dynamic tilt
        pos.xz *= rot(u_time * 1.2);            // Primary spin
        pos.yz *= rot(cos(u_time * 0.6) * 0.2); // Secondary tilt
        mapPos = pos; 
        
        float dStar = sdGemini3D(pos);
        
        return min(dStar, dSp);
    }

    // Gradient normal computation
    vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.005, 0.0);
        return normalize(vec3(
            map(p + e.xyy) - map(p - e.xyy),
            map(p + e.yxy) - map(p - e.yxy),
            map(p + e.yyx) - map(p - e.yyx)
        ));
    }

    // Map material colors physically to the 3D surface
    vec3 getColor() {
        vec3 colBlue   = vec3(66, 133, 244) / 255.0;
        vec3 colYellow = vec3(251, 188, 5)  / 255.0;
        vec3 colRed    = vec3(234, 67, 53)  / 255.0;
        vec3 colGreen  = vec3(52, 168, 83)  / 255.0;

        // Paint sparkles
        vec3 sp0 = sparklePos - vec3( 1.5,  0.4,  0.0); sp0.y += sin(u_time * 3.0 + 0.0) * 0.15; if(length(sp0) < 0.15) return colBlue;
        vec3 sp1 = sparklePos - vec3(-1.5, -0.3,  0.0); sp1.y += sin(u_time * 3.0 + 1.5) * 0.15; if(length(sp1) < 0.15) return colYellow;
        vec3 sp2 = sparklePos - vec3( 0.0,  0.6,  1.5); sp2.y += sin(u_time * 3.0 + 3.0) * 0.15; if(length(sp2) < 0.15) return colRed;
        vec3 sp3 = sparklePos - vec3( 0.0, -0.5, -1.5); sp3.y += sin(u_time * 3.0 + 4.5) * 0.15; if(length(sp3) < 0.15) return colGreen;
        
        // Paint Gemini Star
        vec2 dir = normalize(mapPos.xy + 1e-5);
        
        // Exponential inverse-distance weights lock colors tightly to their quadrants
        float wR = pow(max(0.0,  dir.x), 2.5);
        float wT = pow(max(0.0,  dir.y), 2.5);
        float wL = pow(max(0.0, -dir.x), 2.5);
        float wB = pow(max(0.0, -dir.y), 2.5);
        
        vec3 col = (colBlue * wR + colRed * wT + colYellow * wL + colGreen * wB) / (wR + wT + wL + wB + 1e-5);
        
        // Intense radiant white core fade
        float dist = length(mapPos.xy);
        col = mix(vec3(1.0, 0.98, 0.98), col, smoothstep(0.05, 0.55, dist));
        
        return col;
    }

    void main() {
        // Screen grid UVs snapped for chunky rendering
        vec2 cPos = floor(gl_FragCoord.xy);
        vec2 uv = cPos / u_resolution.xy;
        uv = uv * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        // --- Isometric Orthographic Camera ---
        float scale = 2.4;
        vec3 ro = vec3(uv * scale, 10.0);
        vec3 rd = vec3(0.0, 0.0, -1.0);

        // True math angles for flawless retro isometric perspective
        float angX = -35.264 * 3.14159 / 180.0;
        float angY = -45.0 * 3.14159 / 180.0;
        mat2 rotX = rot(angX);
        mat2 rotY = rot(angY);
        
        ro.yz *= rotX; rd.yz *= rotX;
        ro.xz *= rotY; rd.xz *= rotY;

        // --- Raymarching Loop ---
        float t = 0.0;
        vec3 p;
        float d;
        float minHitDist = 1.0;
        
        for(int i = 0; i < 90; i++) {
            p = ro + rd * t;
            d = map(p);
            minHitDist = min(minHitDist, d);
            if(abs(d) < 0.002 || t > 25.0) break;
            t += d;
        }

        // --- Environmental Shading ---
        vec3 col = vec3(0.06, 0.06, 0.08); 
        float bgDist = length(uv);
        
        // Gorgeous deep ambient backglow
        col += vec3(0.12, 0.16, 0.28) * max(0.0, 1.0 - bgDist * 1.5) * 0.4;
        col *= 1.0 - bgDist * 0.35;

        // Floating Dynamic Drop Shadow
        if (rd.y < -0.001) {
            float tp = (-2.0 - ro.y) / rd.y;
            if (tp > 0.0) {
                vec3 pPlane = ro + rd * tp;
                float shadowDist = length(pPlane.xz);
                float shadowAlpha = smoothstep(2.0, 0.0, shadowDist);
                float floatOffset = sin(u_time * 2.0) * 0.12;
                shadowAlpha *= 0.6 - floatOffset * 0.8; 
                col = mix(col, vec3(0.015), max(0.0, shadowAlpha));
            }
        }

        // --- Object Shading ---
        if(t < 25.0 && abs(d) < 0.005) {
            vec3 n = calcNormal(p);
            vec3 baseCol = getColor();
            
            vec3 lightDir = normalize(vec3(1.0, 1.5, 0.8));
            vec3 lightDir2 = normalize(vec3(-1.0, -0.5, -0.5));
            
            float diff = max(0.0, dot(n, lightDir));
            float diff2 = max(0.0, dot(n, lightDir2));
            
            vec3 viewDir = normalize(ro - p);
            vec3 halfDir = normalize(lightDir + viewDir);
            float spec = pow(max(0.0, dot(n, halfDir)), 24.0);
            
            // Tiered Cel-shading step thresholds for the satisfying pixel-art "crunch"
            diff = smoothstep(0.05, 0.15, diff) * 0.4 + smoothstep(0.5, 0.6, diff) * 0.6;
            spec = step(0.6, spec) * 0.6;
            
            float ambient = 0.4 + 0.1 * n.y;
            col = baseCol * (ambient + diff * 0.7 + diff2 * 0.2) + vec3(0.95, 0.98, 1.0) * spec;
            
            // Bouncy rim lighting
            float fresnel = 1.0 - max(0.0, dot(n, viewDir));
            float rim = smoothstep(0.7, 0.9, fresnel);
            col += baseCol * rim * 0.9;
            
            // Deepen contours naturally
            if (fresnel > 0.85) col *= 0.5;
            
        } else {
            // Generates a flawless, math-perfect 1.5px thick retro black outline around geometries
            float pixWidth = (scale * 2.0) / u_resolution.y;
            if (minHitDist < pixWidth * 1.5) {
                col = vec3(0.04, 0.04, 0.06); 
            }
        }

        // --- Hardware-Accurate Palettization ---
        // High-frequency Bayer Dithering matrix
        float bayer = mod(cPos.x + cPos.y, 2.0) * 0.5 + mod(cPos.y, 2.0) * 0.25;
        bayer -= 0.375; 
        col += bayer * 0.15;
        
        // Heavily quantize the final color ranges to imitate 16-bit console graphics
        float levels = 10.0;
        col = floor(col * levels + 0.5) / levels;

        // Final vignette wash
        col *= 1.0 - smoothstep(1.0, 1.8, length(uv));

        gl_FragColor = vec4(col, 1.0);
    }
`;
