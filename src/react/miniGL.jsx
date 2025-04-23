import React, {
  useRef,
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
} from "react";
import miniGL from "../js/miniGL.js";

// Create contexts for miniGL instance and pass registry
export const MiniGLContext = createContext(null);
export const PassRegistryContext = createContext({});

const MiniGL = ({
  id,
  width = "100%",
  height = "100%",
  style = {},
  className = "",
  children,
  autoRender = true,
  renderInterval = 1000 / 60,
}) => {
  const canvasRef = useRef(null);
  const [gl, setGL] = useState(null);
  const requestRef = useRef(null);
  const previousTimeRef = useRef(0);

  // Use ref for pass registry to avoid re-renders when registering passes
  const passRegistryRef = useRef({});
  const [, forceUpdate] = useState({});

  // Register a pass with an ID - memoize this function with useCallback
  const registerPass = useCallback((id, pass) => {
    if (id) {
      passRegistryRef.current[id] = pass;
      // Only force an update if needed by components that use the registry
      // forceUpdate({});
    }
    return pass;
  }, []);

  // Get a pass by ID (used for references in uniforms)
  const getPassById = useCallback((id) => {
    return passRegistryRef.current[id];
  }, []);

  // Initialize miniGL
  useEffect(() => {
    if (!canvasRef.current) return;

    // Use the provided id or generate one if not provided
    const canvasId =
      id || `minigl-canvas-${Math.random().toString(36).substring(2, 9)}`;
    canvasRef.current.id = canvasId;

    // Create miniGL instance
    const instance = new miniGL(canvasId);
    setGL(instance);

    return () => {
      // Clean up animation loop
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [id]);

  // Animation loop
  useEffect(() => {
    if (!gl || !autoRender) return;

    const animate = (time) => {
      if (time - previousTimeRef.current >= renderInterval) {
        previousTimeRef.current = time;
        gl.render();
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gl, autoRender, renderInterval]);

  // Handle window resize
  useEffect(() => {
    if (!gl) return;

    const handleResize = () => gl.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [gl]);

  const canvasStyle = {
    width,
    height,
    display: "block",
    ...style,
  };

  // Create a pass registry context with methods to register and retrieve passes
  const passRegistryValue = {
    registerPass,
    getPassById,
    registry: passRegistryRef.current,
  };

  return (
    <MiniGLContext.Provider value={gl}>
      <PassRegistryContext.Provider value={passRegistryValue}>
        <canvas ref={canvasRef} style={canvasStyle} className={className} />
        {gl && children}
      </PassRegistryContext.Provider>
    </MiniGLContext.Provider>
  );
};

export default MiniGL;
