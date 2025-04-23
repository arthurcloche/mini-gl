/**
 * Effects.js - Reusable shader effects for miniGL
 *
 * This module provides factory functions for creating shader effects
 * that work with both the vanilla JS and React versions of miniGL.
 */

/**
 * Creates a dithering effect pass
 *
 * @param {Object} options - Configuration options
 * @param {number} options.pattern - Dither pattern size (1-4)
 * @param {number} options.strength - Effect strength (0.0-1.0)
 * @returns {Object} Effect configuration
 */
export const createDitherEffect = (options = {}) => {
  const { pattern = 2, strength = 0.5 } = options;

  const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uStrength;
    uniform int uPattern;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    // Bayer matrices for ordered dithering
    const mat4 bayerMatrix2 = mat4(
      0.0, 0.5, 0.125, 0.625,
      0.75, 0.25, 0.875, 0.375,
      0.1875, 0.6875, 0.0625, 0.5625,
      0.9375, 0.4375, 0.8125, 0.3125
    );
    
    const mat4 bayerMatrix = mat4(
      0.0, 0.5, 0.125, 0.625,
      0.75, 0.25, 0.875, 0.375,
      0.1875, 0.6875, 0.0625, 0.5625,
      0.9375, 0.4375, 0.8125, 0.3125
    );
    
    float getDitherValue(vec2 position, int pattern) {
      if (pattern == 1) {
        // 2x2 Bayer matrix
        int x = int(mod(position.x, 2.0));
        int y = int(mod(position.y, 2.0));
        
        if (x == 0 && y == 0) return 0.0;
        if (x == 1 && y == 0) return 0.5;
        if (x == 0 && y == 1) return 0.75;
        if (x == 1 && y == 1) return 0.25;
        return 0.0;
      } else {
        // 4x4 Bayer matrix
        int x = int(mod(position.x, 4.0));
        int y = int(mod(position.y, 4.0));
        return bayerMatrix[y][x];
      }
    }
    
    void main() {
      vec4 color = texture(uTexture, vTexCoord);
      
      // Apply dithering
      float dither = getDitherValue(gl_FragCoord.xy, uPattern);
      vec3 ditherColor = color.rgb + (dither - 0.5) * uStrength / 10.0;
      
      fragColor = vec4(ditherColor, color.a);
    }
  `;

  const uniforms = {
    uPattern: pattern,
    uStrength: strength,
  };

  const options_config = {};

  return {
    type: "shader",
    fragmentShader,
    uniforms,
    options: options_config,
  };
};

/**
 * Creates a mouse bulge/distortion effect
 *
 * @param {Object} options - Configuration options
 * @param {number} options.radius - Radius of the effect (0.01-0.5)
 * @param {number} options.strength - Strength of the distortion (0.1-2.0)
 * @returns {Object} Effect configuration
 */
export const createMouseBulgeEffect = (options = {}) => {
  const { radius = 0.1, strength = 0.5 } = options;

  const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    uniform float uRadius;
    uniform float uStrength;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    void main() {
      vec2 uv = vTexCoord;
      vec2 center = uMouse;
      
      // Calculate distance from mouse position
      float dist = distance(uv, center);
      
      // Apply bulge effect based on distance
      if (dist < uRadius) {
        float factor = 1.0 - smoothstep(0.0, uRadius, dist);
        vec2 direction = normalize(uv - center);
        uv = uv - direction * factor * uStrength * 0.05;
      }
      
      fragColor = texture(uTexture, uv);
    }
  `;

  const uniforms = {
    uRadius: radius,
    uStrength: strength,
  };

  const options_config = {
    // Additional options if needed
  };

  return {
    type: "shader",
    fragmentShader,
    uniforms,
    options: options_config,
  };
};

// Effect application helpers
export const applyEffectToMiniGL = (gl, effectConfig) => {
  if (effectConfig.type === "shader") {
    return gl.createShaderPass({
      fragmentShader: effectConfig.fragmentShader,
      uniforms: effectConfig.uniforms,
      ...effectConfig.options,
    });
  } else if (effectConfig.type === "pingpong") {
    return gl.createPingPongPass({
      fragmentShader: effectConfig.fragmentShader,
      uniforms: effectConfig.uniforms,
      ...effectConfig.options,
    });
  }
  return null;
};
