import miniGL from "../../lib/miniGL/miniGL.js";
import lenseDistortionNode from "../../lib/miniGL/miniNodes/effects/lenseDistortionNode.js";
import bayerDitherNode from "../../lib/miniGL/miniNodes/effects/bayerDitherNode.js";

async function init() {
  const gl = new miniGL("canvas");

  // Wait for miniNodes to be ready
  await gl.ready();

  const textCanvas = gl.canvas2D(
    (ctx, w, h) => {
      ctx.fillStyle = "rgba(0, 0, 0, 255)"; // Transparent background
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "white";
      ctx.font = '500 80px "Hubot Sans", "Inter", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("HELLO miniGL", w / 2, h / 2);
    },
    { name: "TextCanvas" }
  );

  // Use new API for available nodes, old API for non-migrated ones
  const sphereNode = lenseDistortionNode(
    gl,
    1,
    0.7,
    10,
    1.9,
    "mouse",
    gl.TransparentPixel,
    "Sphere Distortion"
  );

  // Optional: Add blur and dither effects
  // const blurNode = gl.gaussianBlur(8, [1.0, 0.0], { name: 'Blur Effect' });
  // const ditherNode = bayerDitherNode(gl, 2, 1, true, "Dither Effect");

  // Connect using new API
  sphereNode.connect("uTexture", textCanvas);

  // Chain effects if you want them:
  // blurNode.connect('uTexture', textCanvas);
  // sphereNode.connect('uTexture', blurNode);

  gl.output(sphereNode);

  function animate() {
    gl._render();
    requestAnimationFrame(animate);
  }

  // Ensure fonts are loaded before starting animation
  document.fonts.ready.then(() => {
    console.log("Fonts loaded, starting animation");
    animate();
  });
}

init().catch(console.error);
