/**
 * Simplified Fluid Simulation for miniGL
 * A working fluid simulation that integrates properly with miniGL
 */
export function SimpleFluidNode(gl, uniforms = {}) {
    const {
        simResolution = 128,
        dyeResolution = 512,
        densityDissipation = 0.99,
        velocityDissipation = 0.98
    } = uniforms;

    // Helper to get proper resolution
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

    // Simple advection shader
    const advectionShader = `#version 300 es
precision highp float;

uniform sampler2D glPrevious;
uniform sampler2D u_velocity;
uniform vec2 glPixel;
uniform float u_dt;
uniform float u_dissipation;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 coord = glUV - u_dt * texture(u_velocity, glUV).xy * glPixel;
    vec4 result = texture(glPrevious, coord);
    float decay = 1.0 + u_dissipation * u_dt;
    fragColor = result / decay;
}
`;

    // Splat shader to add color/velocity
    const splatShader = `#version 300 es
precision highp float;

uniform sampler2D glTexture;
uniform float glRatio;
uniform vec3 u_color;
uniform vec2 u_point;
uniform float u_radius;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec2 p = glUV - u_point;
    p.x *= glRatio;
    vec3 splat = exp(-dot(p, p) / u_radius) * u_color;
    vec3 base = texture(glTexture, glUV).xyz;
    fragColor = vec4(base + splat, 1.0);
}
`;

    // Display shader
    const displayShader = `#version 300 es
precision highp float;

uniform sampler2D glTexture;

in vec2 glUV;
out vec4 fragColor;

void main() {
    vec3 c = texture(glTexture, glUV).rgb;
    float a = max(c.r, max(c.g, c.b));
    fragColor = vec4(c, a);
}
`;

    // Create the simulation nodes
    const velocityField = gl.pingpong(advectionShader, {
        u_velocity: null,
        u_dt: 0.016,
        u_dissipation: velocityDissipation
    }, {
        format: "FLOAT",
        filter: "LINEAR",
        wrap: "CLAMP_TO_EDGE",
        width: simRes.width,
        height: simRes.height
    });

    const dyeField = gl.pingpong(advectionShader, {
        u_velocity: null,
        u_dt: 0.016,
        u_dissipation: densityDissipation
    }, {
        format: "FLOAT",
        filter: "LINEAR",
        wrap: "CLAMP_TO_EDGE",
        width: dyeRes.width,
        height: dyeRes.height
    });

    const splatNode = gl.shader(splatShader, {
        u_color: [1.0, 0.0, 0.0],
        u_point: [0.5, 0.5],
        u_radius: 0.01
    });

    const displayNode = gl.shader(displayShader, {});

    // Connect the pipeline
    gl.connect(dyeField, displayNode, "glTexture");
    gl.output(displayNode);

    // Add some initial color to see something
    splatNode.updateUniform("u_point", { x: 0.5, y: 0.5 });
    splatNode.updateUniform("u_color", { x: 1.0, y: 0.5, z: 0.0 });
    splatNode.updateUniform("u_radius", 0.1);
    splatNode.connect("glTexture", dyeField);
    splatNode.process();

    // Create the fluid object
    const fluid = {
        addSplat(x, y, dx, dy, color) {
            // Add velocity splat
            splatNode.updateUniform("u_point", { x, y });
            splatNode.updateUniform("u_color", { x: dx * 0.1, y: dy * 0.1, z: 0.0 });
            splatNode.updateUniform("u_radius", 0.01);
            splatNode.connect("glTexture", velocityField);
            splatNode.process();
            
            // Add color splat
            splatNode.updateUniform("u_color", { x: color[0], y: color[1], z: color[2] });
            splatNode.updateUniform("u_radius", 0.02);
            splatNode.connect("glTexture", dyeField);
            splatNode.process();
        },

        step(dt) {
            // Update time step
            velocityField.updateUniform("u_dt", dt);
            dyeField.updateUniform("u_dt", dt);

            // Connect velocity field to itself for advection
            velocityField.connect("u_velocity", velocityField);
            velocityField.process();

            // Connect velocity to dye field for advection
            dyeField.connect("u_velocity", velocityField);
            dyeField.process();

            // Render
            displayNode.process();
        },

        updateUniform(name, value) {
            switch(name) {
                case "splatRadius":
                    // Will be set per splat
                    break;
                case "velocityDissipation":
                    velocityField.updateUniform("u_dissipation", value);
                    break;
                case "densityDissipation":
                    dyeField.updateUniform("u_dissipation", value);
                    break;
            }
        }
    };

    return fluid;
}