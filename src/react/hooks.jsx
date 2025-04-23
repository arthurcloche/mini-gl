import { useContext, useEffect, useRef } from "react";
import { MiniGLContext, PassRegistryContext } from "./miniGL.jsx";

/**
 * Hook to get a reference to the current miniGL instance
 */
export const useMiniGL = () => {
  return useContext(MiniGLContext);
};

/**
 * Hook to get a reference to the pass registry
 */
export const usePassRegistry = () => {
  return useContext(PassRegistryContext);
};

/**
 * Hook to use a shader pass in a React component
 */
export const useShaderPass = (fragmentShader, uniforms = {}, options = {}) => {
  const gl = useMiniGL();
  const { getPassById } = usePassRegistry();
  const passRef = useRef(null);

  useEffect(() => {
    if (!gl) return;

    // Create the shader pass
    passRef.current = gl.createShaderPass({
      fragmentShader,
      uniforms,
      ...options,
    });

    return () => {
      // Basic cleanup
      if (passRef.current && gl.passes) {
        const index = gl.passes.indexOf(passRef.current);
        if (index !== -1) {
          gl.passes.splice(index, 1);
        }
      }
    };
  }, [gl, fragmentShader]);

  // Update uniforms when they change or when referenced passes change
  useEffect(() => {
    if (!gl || !passRef.current) return;

    // Process uniform values that might reference other passes by ID
    const processedUniforms = { ...uniforms };
    Object.entries(uniforms).forEach(([key, value]) => {
      if (typeof value === "string") {
        const referencedPass = getPassById(value);
        if (referencedPass) {
          processedUniforms[key] = referencedPass;
        }
      }
    });

    // Update only changed uniforms
    Object.entries(processedUniforms).forEach(([key, value]) => {
      if (passRef.current.uniforms[key] !== value) {
        passRef.current.uniforms[key] = value;
      }
    });
  }, [gl, uniforms, getPassById]);

  return passRef.current;
};

/**
 * Hook to use a ping-pong pass in a React component
 */
export const usePingPongPass = (
  fragmentShader,
  uniforms = {},
  options = {}
) => {
  const gl = useMiniGL();
  const { getPassById } = usePassRegistry();
  const passRef = useRef(null);

  useEffect(() => {
    if (!gl) return;

    // Create the ping-pong pass
    passRef.current = gl.createPingPongPass({
      fragmentShader,
      uniforms,
      ...options,
    });

    return () => {
      // Cleanup logic if needed
    };
  }, [gl, fragmentShader]);

  // Update uniforms when they change or when referenced passes change
  useEffect(() => {
    if (!gl || !passRef.current) return;

    // Process uniform values that might reference other passes by ID
    const processedUniforms = { ...uniforms };
    Object.entries(uniforms).forEach(([key, value]) => {
      if (typeof value === "string") {
        const referencedPass = getPassById(value);
        if (referencedPass) {
          processedUniforms[key] = referencedPass;
        }
      }
    });

    // Update only changed uniforms
    Object.entries(processedUniforms).forEach(([key, value]) => {
      if (passRef.current.uniforms[key] !== value) {
        passRef.current.uniforms[key] = value;
      }
    });
  }, [gl, uniforms, getPassById]);

  return passRef.current;
};

/**
 * Hook to use a texture in a React component
 */
export const useTexture = (source, options = {}) => {
  const gl = useMiniGL();
  const textureRef = useRef(null);

  useEffect(() => {
    if (!gl) return;

    const loadTexture = async () => {
      try {
        let texture;

        if (typeof source === "string") {
          // Handle URL source (image)
          texture = await gl.imageTexture(source, options);
        } else if (typeof source === "function") {
          // Handle canvas draw function
          texture = gl.canvasTexture(source, options);
        }

        textureRef.current = texture;
      } catch (error) {
        console.error("Error loading texture:", error);
      }
    };

    loadTexture();

    return () => {
      // Cleanup if needed
    };
  }, [gl, source]);

  return textureRef.current;
};

/**
 * Hook to manage render targets
 */
export const useRenderTarget = (options = {}) => {
  const gl = useMiniGL();
  const targetRef = useRef(null);

  useEffect(() => {
    if (!gl) return;

    targetRef.current = gl.createRenderTarget(
      gl.canvas.width,
      gl.canvas.height,
      options
    );

    return () => {
      // Cleanup if needed
    };
  }, [gl]);

  return targetRef.current;
};
