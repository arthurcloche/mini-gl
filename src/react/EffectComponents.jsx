import React, { useEffect, useRef, useContext } from "react";
import { MiniGLContext, PassRegistryContext } from "./miniGL.jsx";
import { useShaderPass, usePingPongPass, useMiniGL } from "./hooks.jsx";

/**
 * Pass Component - Creates a shader pass
 */
export const Pass = ({ fragment, uniforms = {}, id = null, options = {} }) => {
  const gl = useContext(MiniGLContext);
  const { registerPass, getPassById, registry } =
    useContext(PassRegistryContext);
  const passRef = useRef(null);

  // Store the id in a ref to avoid re-running the effect when it doesn't change
  const idRef = useRef(id);
  idRef.current = id;

  // Process uniforms to resolve references to other passes
  const processedUniforms = { ...uniforms };

  // Replace string references with actual pass textures
  Object.entries(uniforms).forEach(([key, value]) => {
    if (typeof value === "string" && registry[value]) {
      processedUniforms[key] = registry[value];
    }
  });

  // Create the shader pass
  useEffect(() => {
    if (!gl) return;

    const pass = gl.createShaderPass({
      fragmentShader: fragment,
      uniforms: processedUniforms,
      ...options,
    });

    passRef.current = pass;

    // Register pass with ID if provided
    if (idRef.current) {
      registerPass(idRef.current, pass);
    }

    return () => {
      // Cleanup when component unmounts
      if (passRef.current && gl.passes) {
        const index = gl.passes.indexOf(passRef.current);
        if (index !== -1) {
          gl.passes.splice(index, 1);
        }
      }
    };
    // Remove registerPass and id from dependencies to prevent infinite updates
  }, [gl, fragment, options]);

  // Update uniforms when they change
  useEffect(() => {
    if (!gl || !passRef.current) return;

    // Update processed uniforms
    Object.entries(processedUniforms).forEach(([key, value]) => {
      if (passRef.current.uniforms[key] !== value) {
        passRef.current.uniforms[key] = value;
      }
    });
  }, [gl, processedUniforms, registry]);

  return null; // This is a logic-only component
};

/**
 * PingPongPass Component - Creates a ping-pong render pass for iterative effects
 */
export const PingPongPass = ({
  fragment,
  uniforms = {},
  id = null,
  options = {},
}) => {
  const gl = useContext(MiniGLContext);
  const { registerPass, getPassById, registry } =
    useContext(PassRegistryContext);
  const passRef = useRef(null);

  // Process uniforms to resolve references to other passes
  const processedUniforms = { ...uniforms };

  // Replace string references with actual pass textures
  Object.entries(uniforms).forEach(([key, value]) => {
    if (typeof value === "string" && registry[value]) {
      processedUniforms[key] = registry[value];
    }
  });

  // Create the ping-pong pass
  useEffect(() => {
    if (!gl) return;

    // Use miniGL's createPingPongPass directly
    const pass = gl.createPingPongPass({
      fragmentShader: fragment,
      uniforms: processedUniforms,
      ...options,
    });

    passRef.current = pass;

    // Register pass with ID if provided
    if (id) {
      registerPass(id, pass);
    }

    return () => {
      // Cleanup when component unmounts
      if (passRef.current && gl.passes) {
        const index = gl.passes.indexOf(passRef.current);
        if (index !== -1) {
          gl.passes.splice(index, 1);
        }
      }
    };
  }, [gl, fragment, options, id]);

  // Update uniforms when they change
  useEffect(() => {
    if (!gl || !passRef.current) return;

    // Update processed uniforms
    Object.entries(processedUniforms).forEach(([key, value]) => {
      if (passRef.current.uniforms[key] !== value) {
        passRef.current.uniforms[key] = value;
      }
    });
  }, [gl, processedUniforms, registry]);

  return null; // This is a logic-only component
};

/**
 * Helper function to update a canvas texture (since miniGL doesn't provide this)
 * @param {WebGLRenderingContext} glContext - WebGL context
 * @param {WebGLTexture} texture - WebGL texture to update
 * @param {HTMLCanvasElement} canvas - Canvas element containing the image data
 */
function updateCanvasTexture(glContext, texture, canvas) {
  if (!glContext || !texture || !canvas) return;

  const gl = glContext.gl || glContext; // Handle both miniGL and raw WebGL contexts

  // Save the current texture binding
  const prevTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);

  // Bind the texture we want to update
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Update the texture with new canvas content
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

  // Restore previous texture binding
  gl.bindTexture(gl.TEXTURE_2D, prevTexture);
}

/**
 * Canvas Component - Creates a canvas texture
 */
export const Canvas = ({
  width = 512,
  height = 512,
  draw,
  className = "",
  animated = false,
  ...props
}) => {
  const gl = useMiniGL();
  const { registerPass } = useContext(PassRegistryContext);
  const textureRef = useRef(null);

  useEffect(() => {
    if (!gl) return;

    // Use miniGL's canvasTexture function directly - this creates a canvas internally
    const texture = gl.canvasTexture(draw, {
      width,
      height,
      // If animated, provide update function that will be called
      // during miniGL's render loop
      update: animated === true || animated === "true" ? draw : undefined,
    });

    // Store reference
    textureRef.current = texture;

    // Register with pass registry using the texture property
    if (props.id && texture) {
      registerPass(props.id, { texture: texture.texture });
    }

    return () => {
      // Clean up texture when component unmounts
      if (texture && texture.texture) {
        // Remove from dynamic textures list if it's there
        if (gl.dynamicTextures) {
          const index = gl.dynamicTextures.indexOf(texture);
          if (index !== -1) {
            gl.dynamicTextures.splice(index, 1);
          }
        }

        // Delete the texture
        gl.gl.deleteTexture(texture.texture);
      }
    };
  }, [gl, draw, width, height, animated, props.id]);

  // No need to render an actual canvas - miniGL creates one internally
  return null;
};

/**
 * Image Component - Creates an image texture
 */
export const Image = ({ src, options = {}, id = null }) => {
  const gl = useContext(MiniGLContext);
  const { registerPass } = useContext(PassRegistryContext);
  const textureRef = useRef(null);

  useEffect(() => {
    if (!gl || !src) return;

    let isMounted = true;

    // Use miniGL's imageTexture method directly
    gl.imageTexture(src, options)
      .then((textureObj) => {
        if (!isMounted) return;

        textureRef.current = textureObj;

        // Register with ID if provided
        if (id && textureObj) {
          registerPass(id, { texture: textureObj.texture });
        }
      })
      .catch((err) => {
        console.error("Error loading image texture:", err);
      });

    return () => {
      isMounted = false;

      // Clean up texture when component unmounts
      if (textureRef.current && textureRef.current.texture) {
        gl.gl.deleteTexture(textureRef.current.texture);
      }
    };
  }, [gl, src, id, options]);

  return null;
};

/**
 * BACKWARD COMPATIBILITY COMPONENTS
 * These are provided for compatibility with existing code
 */

/**
 * Generic Effect component that applies an effect configuration
 * (Backward compatibility with the previous API)
 */
export const Effect = ({ config, uniforms = {} }) => {
  const combinedUniforms = { ...config.uniforms, ...uniforms };

  if (config.type === "pingpong") {
    return (
      <PingPongPass
        fragment={config.fragmentShader}
        uniforms={combinedUniforms}
        options={config.options}
      />
    );
  }

  return (
    <Pass
      fragment={config.fragmentShader}
      uniforms={combinedUniforms}
      options={config.options}
    />
  );
};

/**
 * Dither effect component
 * (Backward compatibility with the previous API)
 */
export const DitherEffect = ({ pattern = 2, strength = 0.5, previousPass }) => {
  const fragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uStrength;
    uniform int uPattern;
    
    in vec2 vTexCoord;
    out vec4 fragColor;
    
    // Bayer matrices for ordered dithering
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

  return (
    <Pass
      fragment={fragmentShader}
      uniforms={{
        uTexture: previousPass,
        uPattern: pattern,
        uStrength: strength,
      }}
    />
  );
};

/**
 * Mouse bulge effect component
 * (Backward compatibility with the previous API)
 */
export const MouseBulgeEffect = ({
  radius = 0.1,
  strength = 0.5,
  previousPass,
}) => {
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

  return (
    <Pass
      fragment={fragmentShader}
      uniforms={{
        uTexture: previousPass,
        uRadius: radius,
        uStrength: strength,
      }}
    />
  );
};
