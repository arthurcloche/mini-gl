/**
 * Complete Fluid Simulation Node for miniGL
 * Based on the React component reference implementation
 */
export function FluidSimulationNode(gl, uniforms = {}) {
    const {
        simResolution = 128,
        dyeResolution = 1440,
        densityDissipation = 3.5,
        velocityDissipation = 2,
        pressure = 0.1,
        pressureIterations = 20,
        curl = 3,
        splatRadius = 0.2,
        splatForce = 6000,
        shading = true
    } = uniforms;

    // Helper function to get resolution based on aspect ratio
    const getResolution = (resolution) => {
        const canvas = gl.canvas;
        let aspectRatio = canvas.width / canvas.height;
        if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
        const min = Math.round(resolution);
        const max = Math.round(resolution * aspectRatio);
        if (canvas.width > canvas.height) {
            return { width: max, height: min };
        } else {
            return { width: min, height: max };
        }
    };

    const simRes = getResolution(simResolution);
    const dyeRes = getResolution(dyeResolution);

    // Display shader
    const displayShader = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 glPixel;
uniform bool uShading;
in vec2 glUV;
out vec4 fragColor;

vec3 linearToGamma(vec3 color) {
    color = max(color, vec3(0));
    return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
}

void main() {
    vec3 c = texture(uTexture, glUV).rgb;
    
    if (uShading) {
        vec2 texelSize = glPixel;
        vec2 vL = glUV - vec2(texelSize.x, 0.0);
        vec2 vR = glUV + vec2(texelSize.x, 0.0);
        vec2 vT = glUV + vec2(0.0, texelSize.y);
        vec2 vB = glUV - vec2(0.0, texelSize.y);
        
        vec3 lc = texture(uTexture, vL).rgb;
        vec3 rc = texture(uTexture, vR).rgb;
        vec3 tc = texture(uTexture, vT).rgb;
        vec3 bc = texture(uTexture, vB).rgb;

        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);

        vec3 n = normalize(vec3(dx, dy, length(texelSize)));
        vec3 l = vec3(0.0, 0.0, 1.0);

        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
        c *= diffuse;
    }

    float a = max(c.r, max(c.g, c.b));
    fragColor = vec4(c, a);
}`;

    // Splat shader
    const splatShader = `#version 300 es
precision highp float;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 p = glUV - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture(uTarget, glUV).xyz;
    fragColor = vec4(base + splat, 1.0);
}`;

    // Velocity advection shader (ping-pong)
    const velocityAdvectionShader = `#version 300 es
precision highp float;
uniform sampler2D glPrevious;
uniform sampler2D uVelocity;
uniform vec2 glPixel;
uniform float dt;
uniform float dissipation;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 coord = glUV - dt * texture(uVelocity, glUV).xy * glPixel;
    vec4 result = texture(uVelocity, coord);
    float decay = 1.0 + dissipation * dt;
    fragColor = result / decay;
}`;

    // Dye advection shader (ping-pong)
    const dyeAdvectionShader = `#version 300 es
precision highp float;
uniform sampler2D glPrevious;
uniform sampler2D uVelocity;
uniform vec2 glPixel;
uniform float dt;
uniform float dissipation;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 coord = glUV - dt * texture(uVelocity, glUV).xy * glPixel;
    vec4 result = texture(glPrevious, coord);
    float decay = 1.0 + dissipation * dt;
    fragColor = result / decay;
}`;

    // Divergence shader
    const divergenceShader = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 glPixel;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = glPixel;
    vec2 vL = glUV - vec2(texelSize.x, 0.0);
    vec2 vR = glUV + vec2(texelSize.x, 0.0);
    vec2 vT = glUV + vec2(0.0, texelSize.y);
    vec2 vB = glUV - vec2(0.0, texelSize.y);
    
    float L = texture(uVelocity, vL).x;
    float R = texture(uVelocity, vR).x;
    float T = texture(uVelocity, vT).y;
    float B = texture(uVelocity, vB).y;

    vec2 C = texture(uVelocity, glUV).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }

    float div = 0.5 * (R - L + T - B);
    fragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

    // Curl shader
    const curlShader = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 glPixel;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = glPixel;
    vec2 vL = glUV - vec2(texelSize.x, 0.0);
    vec2 vR = glUV + vec2(texelSize.x, 0.0);
    vec2 vT = glUV + vec2(0.0, texelSize.y);
    vec2 vB = glUV - vec2(0.0, texelSize.y);
    
    float L = texture(uVelocity, vL).y;
    float R = texture(uVelocity, vR).y;
    float T = texture(uVelocity, vT).x;
    float B = texture(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}`;

    // Vorticity shader
    const vorticityShader = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
uniform vec2 glPixel;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = glPixel;
    vec2 vL = glUV - vec2(texelSize.x, 0.0);
    vec2 vR = glUV + vec2(texelSize.x, 0.0);
    vec2 vT = glUV + vec2(0.0, texelSize.y);
    vec2 vB = glUV - vec2(0.0, texelSize.y);
    
    float L = texture(uCurl, vL).x;
    float R = texture(uCurl, vR).x;
    float T = texture(uCurl, vT).x;
    float B = texture(uCurl, vB).x;
    float C = texture(uCurl, glUV).x;

    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;

    vec2 velocity = texture(uVelocity, glUV).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    fragColor = vec4(velocity, 0.0, 1.0);
}`;

    // Pressure shader for ping-pong
    const pressureShader = `#version 300 es
precision highp float;
uniform sampler2D glPrevious;
uniform sampler2D uDivergence;
uniform vec2 glPixel;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = glPixel;
    vec2 vL = glUV - vec2(texelSize.x, 0.0);
    vec2 vR = glUV + vec2(texelSize.x, 0.0);
    vec2 vT = glUV + vec2(0.0, texelSize.y);
    vec2 vB = glUV - vec2(0.0, texelSize.y);
    
    float L = texture(glPrevious, vL).x;
    float R = texture(glPrevious, vR).x;
    float T = texture(glPrevious, vT).x;
    float B = texture(glPrevious, vB).x;
    float divergence = texture(uDivergence, glUV).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

    // Gradient subtract shader
    const gradientSubtractShader = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 glPixel;
in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = glPixel;
    vec2 vL = glUV - vec2(texelSize.x, 0.0);
    vec2 vR = glUV + vec2(texelSize.x, 0.0);
    vec2 vT = glUV + vec2(0.0, texelSize.y);
    vec2 vB = glUV - vec2(0.0, texelSize.y);
    
    float L = texture(uPressure, vL).x;
    float R = texture(uPressure, vR).x;
    float T = texture(uPressure, vT).x;
    float B = texture(uPressure, vB).x;
    vec2 velocity = texture(uVelocity, glUV).xy;
    velocity.xy -= vec2(R - L, T - B);
    fragColor = vec4(velocity, 0.0, 1.0);
}`;

    // Clear shader
    const clearShader = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float value;
in vec2 glUV;
out vec4 fragColor;

void main() {
    fragColor = value * texture(uTexture, glUV);
}`;

    // Create ping-pong buffers for velocity and dye
    const velocityField = gl.pingpong(velocityAdvectionShader, {
        uVelocity: null,
        dt: 0.016,
        dissipation: velocityDissipation
    }, {
        format: "FLOAT",
        filter: "LINEAR",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height,
        name: "Velocity Field"
    });

    const dyeField = gl.pingpong(dyeAdvectionShader, {
        uVelocity: null,
        dt: 0.016,
        dissipation: densityDissipation
    }, {
        format: "FLOAT",
        filter: "LINEAR",
        wrap: "CLAMP_TO_EDGE",
        width: dyeRes.width,
        height: dyeRes.height,
        name: "Dye Field"
    });

    const pressureField = gl.pingpong(pressureShader, {
        uDivergence: null
    }, {
        format: "FLOAT",
        filter: "NEAREST",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height,
        name: "Pressure Field"
    });

    // Create single-pass nodes
    const divergenceNode = gl.shader(divergenceShader, {
        uVelocity: null
    }, {
        format: "FLOAT",
        filter: "NEAREST",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height,
        name: "Divergence"
    });

    const curlNode = gl.shader(curlShader, {
        uVelocity: null
    }, {
        format: "FLOAT",
        filter: "NEAREST",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height,
        name: "Curl"
    });

    const vorticityNode = gl.shader(vorticityShader, {
        uVelocity: null,
        uCurl: null,
        curl: curl,
        dt: 0.016
    }, {
        format: "FLOAT",
        filter: "LINEAR",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height,
        name: "Vorticity"
    });

    const gradientSubtractNode = gl.shader(gradientSubtractShader, {
        uPressure: null,
        uVelocity: null
    }, {
        format: "FLOAT",
        filter: "LINEAR",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height,
        name: "Gradient Subtract"
    });

    const splatNode = gl.shader(splatShader, {
        uTarget: null,
        aspectRatio: gl.canvas.width / gl.canvas.height,
        color: [1.0, 1.0, 1.0],
        point: [0.5, 0.5],
        radius: splatRadius
    });

    const clearNode = gl.shader(clearShader, {
        uTexture: null,
        value: pressure
    });

    const displayNode = gl.shader(displayShader, {
        uTexture: null,
        uShading: shading
    });

    // Set up basic connections
    gl.connect(dyeField, displayNode, "uTexture");
    gl.output(displayNode);

    // Create fluid simulation object
    const fluid = {
        addSplat(x, y, dx, dy, color) {
            const aspectRatio = gl.canvas.width / gl.canvas.height;
            const correctedRadius = splatRadius / 100.0;
            const radius = aspectRatio > 1 ? correctedRadius * aspectRatio : correctedRadius;
            
            // Add velocity splat
            splatNode.updateUniform("aspectRatio", aspectRatio);
            splatNode.updateUniform("point", { x, y });
            splatNode.updateUniform("color", { x: dx, y: dy, z: 0.0 });
            splatNode.updateUniform("radius", radius);
            gl.connect(velocityField, splatNode, "uTarget");
            splatNode.process();
            
            // Add color splat
            splatNode.updateUniform("color", { x: color[0], y: color[1], z: color[2] });
            gl.connect(dyeField, splatNode, "uTarget");
            splatNode.process();
        },

        step(dt) {
            // Update time step
            velocityField.updateUniform("dt", dt);
            dyeField.updateUniform("dt", dt);
            vorticityNode.updateUniform("dt", dt);

            // 1. Calculate curl from velocity
            gl.connect(velocityField, curlNode, "uVelocity");
            curlNode.process();

            // 2. Apply vorticity confinement
            gl.connect(velocityField, vorticityNode, "uVelocity");
            gl.connect(curlNode, vorticityNode, "uCurl");
            vorticityNode.process();

            // 3. Calculate divergence from velocity
            gl.connect(vorticityNode, divergenceNode, "uVelocity");
            divergenceNode.process();

            // 4. Clear pressure field
            gl.connect(pressureField, clearNode, "uTexture");
            clearNode.process();

            // 5. Solve pressure (Jacobi iterations)
            gl.connect(divergenceNode, pressureField, "uDivergence");
            for (let i = 0; i < pressureIterations; i++) {
                pressureField.process();
            }

            // 6. Apply pressure correction (gradient subtract)
            gl.connect(pressureField, gradientSubtractNode, "uPressure");
            gl.connect(vorticityNode, gradientSubtractNode, "uVelocity");
            gradientSubtractNode.process();

            // 7. Advect velocity
            gl.connect(gradientSubtractNode, velocityField, "uVelocity");
            velocityField.process();

            // 8. Advect dye
            gl.connect(velocityField, dyeField, "uVelocity");
            dyeField.process();

            // 9. Update display
            gl.connect(dyeField, displayNode, "uTexture");
            displayNode.process();
        },

        updateUniform(name, value) {
            switch(name) {
                case "curl":
                    vorticityNode.updateUniform("curl", value);
                    break;
                case "pressure":
                    clearNode.updateUniform("value", value);
                    break;
                case "splatRadius":
                    splatNode.updateUniform("radius", value);
                    break;
                case "shading":
                    displayNode.updateUniform("uShading", value);
                    break;
                case "velocityDissipation":
                    velocityField.updateUniform("dissipation", value);
                    break;
                case "densityDissipation":
                    dyeField.updateUniform("dissipation", value);
                    break;
                case "splatForce":
                    // Store for use in addSplat
                    fluid.splatForce = value;
                    break;
            }
        },

        get nodes() {
            return {
                velocity: velocityField,
                dye: dyeField,
                divergence: divergenceNode,
                curl: curlNode,
                vorticity: vorticityNode,
                pressure: pressureField,
                gradientSubtract: gradientSubtractNode,
                splat: splatNode,
                clear: clearNode,
                display: displayNode
            };
        }
    };

    // Initialize with some content
    fluid.splatForce = splatForce;
    fluid.addSplat(0.5, 0.5, 0, 0, [1, 1, 1]);

    return fluid;
}