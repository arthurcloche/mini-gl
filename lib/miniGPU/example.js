// Example usage of miniGPU
import miniGPU from "./miniGPU.js";

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create canvas if it doesn't exist
  if (!document.getElementById("canvas")) {
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    document.body.appendChild(canvas);
  }

  // Initialize miniGPU
  const gpu = new miniGPU("canvas");

  // Create default shaders
  gpu.createDefaultShaders();

  // After device initialization, create and connect nodes
  setTimeout(async () => {
    if (!gpu.device) {
      console.error("WebGPU not supported or initialization failed");
      document.body.innerHTML =
        '<div style="color: red; padding: 20px;">WebGPU not supported in this browser.</div>';
      return;
    }

    // Create a circle shader
    const circleNode = gpu.shader(gpu.defaultShaders.circle, {
      name: "CircleShader",
    });

    // Create a ripple effect
    const rippleNode = gpu.shader(gpu.defaultShaders.ripple, {
      name: "RippleShader",
    });

    // Create a blend node to combine them
    const blendNode = gpu.blend({
      blendMode: "screen",
      opacity: 0.8,
      name: "BlendNode",
    });

    // Connect the nodes
    gpu.connect(circleNode, blendNode, "baseTexture");
    gpu.connect(rippleNode, blendNode, "blendTexture");

    // Set the output
    gpu.output(blendNode);

    // Start rendering
    gpu.start();

    // Optionally add controls
    createControls(gpu, blendNode);
  }, 100); // Small delay to ensure WebGPU initialization
});

// Helper function to create basic controls
function createControls(gpu, blendNode) {
  const controls = document.createElement("div");
  controls.style.position = "fixed";
  controls.style.top = "20px";
  controls.style.right = "20px";
  controls.style.background = "rgba(0,0,0,0.7)";
  controls.style.padding = "10px";
  controls.style.borderRadius = "5px";
  controls.style.color = "white";
  controls.style.fontFamily = "Arial, sans-serif";

  // Blend mode selector
  const blendModeLabel = document.createElement("div");
  blendModeLabel.textContent = "Blend Mode:";
  controls.appendChild(blendModeLabel);

  const blendModeSelect = document.createElement("select");
  ["normal", "screen", "multiply", "add", "overlay"].forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode;
    if (mode === "screen") option.selected = true;
    blendModeSelect.appendChild(option);
  });

  blendModeSelect.style.width = "100%";
  blendModeSelect.style.marginBottom = "10px";
  controls.appendChild(blendModeSelect);

  // Opacity slider
  const opacityLabel = document.createElement("div");
  opacityLabel.textContent = "Opacity:";
  controls.appendChild(opacityLabel);

  const opacitySlider = document.createElement("input");
  opacitySlider.type = "range";
  opacitySlider.min = "0";
  opacitySlider.max = "1";
  opacitySlider.step = "0.01";
  opacitySlider.value = "0.8";
  opacitySlider.style.width = "100%";
  controls.appendChild(opacitySlider);

  // Add event listeners
  blendModeSelect.addEventListener("change", () => {
    // When blend mode changes, we need to create a new blend node
    const opacity = parseFloat(opacitySlider.value);
    const newBlendNode = gpu.blend({
      blendMode: blendModeSelect.value,
      opacity,
      name: `Blend_${blendModeSelect.value}`,
    });

    // Reconnect nodes
    const inputs = Array.from(blendNode.inputs.entries());
    for (const [inputName, connection] of inputs) {
      gpu.connect(connection.node, newBlendNode, inputName);
    }

    // Set as output
    gpu.output(newBlendNode);

    // Update reference for controls
    blendNode = newBlendNode;
  });

  opacitySlider.addEventListener("input", () => {
    blendNode.setOpacity(parseFloat(opacitySlider.value));
  });

  document.body.appendChild(controls);
}
