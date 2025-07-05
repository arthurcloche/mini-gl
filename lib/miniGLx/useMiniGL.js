import { useEffect, useRef, useCallback, useState } from "react";
import miniGL from "../miniGL/miniGL.js";

/**
 * Compare two dependency arrays for deep equality
 */
function areDepsEqual(prevDeps, nextDeps) {
  if (!prevDeps || !nextDeps) return false;
  if (prevDeps.length !== nextDeps.length) return false;

  for (let i = 0; i < prevDeps.length; i++) {
    if (prevDeps[i] !== nextDeps[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Clear all nodes from miniGL instance while preserving the GL context
 */
function clearNodes(gl) {
  // Stop rendering
  gl.stop();

  // Dispose all nodes
  for (const node of gl.nodes.values()) {
    if (node.dispose) {
      node.dispose();
    }
  }

  // Clear the nodes map
  gl.nodes.clear();

  // Clear output node
  gl.outputNode = null;

  // Mark graph as dirty (though it will be marked when new nodes are added)
  gl._graphDirty = true;

  console.log("🧹 Cleared all nodes from graph");
}

/**
 * useMiniGL - React hook for miniGL shader graphs
 *
 * @param {React.RefObject} canvasRef - Ref to the target DOM element
 * @param {Function} setupCallback - Function that receives gl instance and should return node references
 * @param {Array} deps - Dependency array for selective rebuilds
 * @param {Object} options - miniGL options (fps, contextOptions, etc.)
 * @returns {Object} - { gl, nodeRefs, isReady }
 */
export function useMiniGL(canvasRef, setupCallback, deps = [], options = {}) {
  const glRef = useRef(null);
  const nodeRefsRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const prevDepsRef = useRef();
  const setupCallbackRef = useRef(setupCallback);
  const initialSetupDoneRef = useRef(false);

  // Keep setup callback ref up to date
  setupCallbackRef.current = setupCallback;

  // Initialize miniGL instance
  useEffect(() => {
    if (!canvasRef.current) return;

    // Prevent double initialization
    if (glRef.current) {
      console.log("⚠️ miniGL already initialized, skipping");
      return;
    }

    // Clear any existing canvases from the target element to prevent duplicates
    const existingCanvases = canvasRef.current.querySelectorAll("canvas");
    existingCanvases.forEach((canvas) => canvas.remove());

    try {
      // Create miniGL instance with target element
      const gl = new miniGL(canvasRef.current, {
        fps: 60,
        ...options,
      });

      glRef.current = gl;
      setIsReady(true);
      initialSetupDoneRef.current = false;

      console.log("✓ miniGL initialized");
    } catch (error) {
      console.error("Failed to initialize miniGL:", error);
      setIsReady(false);
    }

    // Cleanup function
    return () => {
      if (glRef.current) {
        glRef.current.stop();
        glRef.current.dispose();
        glRef.current = null;
        nodeRefsRef.current = null;
        setIsReady(false);
        initialSetupDoneRef.current = false;
        console.log("✓ miniGL cleaned up");
      }

      // Also clean up any remaining canvases
      if (canvasRef.current) {
        const canvases = canvasRef.current.querySelectorAll("canvas");
        canvases.forEach((canvas) => canvas.remove());
      }
    };
  }, [canvasRef]); // Only reinitialize if canvas ref changes

  // Handle initial setup and dependency changes
  useEffect(() => {
    if (!glRef.current || !isReady) return;
    if (!setupCallbackRef.current) return;

    const gl = glRef.current;
    const isInitialSetup = !initialSetupDoneRef.current;
    const depsChanged = !areDepsEqual(prevDepsRef.current, deps);

    if (isInitialSetup) {
      console.log("🚀 Running initial setup");

      // Run initial setup
      const nodeRefs = setupCallbackRef.current(gl);
      nodeRefsRef.current = nodeRefs || {};

      // Start rendering if we have an output node
      if (gl.outputNode) {
        gl.render();
      }

      initialSetupDoneRef.current = true;
      prevDepsRef.current = deps;
    } else if (depsChanged) {
      console.log("🔄 Dependencies changed, rebuilding graph");
      console.log("  Previous:", prevDepsRef.current);
      console.log("  Current:", deps);

      // Clear existing graph but preserve GL context
      clearNodes(gl);

      // Run setup callback to rebuild graph
      const nodeRefs = setupCallbackRef.current(gl);
      nodeRefsRef.current = nodeRefs || {};

      // Restart rendering if we have an output node
      if (gl.outputNode) {
        gl.render();
      }

      prevDepsRef.current = deps;
    }
  }, [isReady, ...deps]); // Dependency changes trigger this effect

  // Return stable references
  return {
    gl: glRef.current,
    nodeRefs: nodeRefsRef.current,
    isReady,
  };
}

/**
 * Custom hook for creating reusable shader effects
 * This allows for composition and encapsulation of common patterns
 */
export function createShaderEffect(setupFn) {
  return function useShaderEffect(gl, deps = {}) {
    return setupFn(gl, deps);
  };
}

/**
 * Helper function to create a stable node reference system
 * This can be used to maintain references to nodes for runtime updates
 */
export function createNodeRefs(nodeMap) {
  const refs = {};

  for (const [key, node] of Object.entries(nodeMap)) {
    refs[key] = {
      node,
      updateUniform: (uniformName, value) => {
        if (node && node.updateUniform) {
          node.updateUniform(uniformName, value);
        }
      },
      dispose: () => {
        if (node && node.dispose) {
          node.dispose();
        }
      },
    };
  }

  return refs;
}

export default useMiniGL;
