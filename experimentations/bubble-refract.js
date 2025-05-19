import miniGL, { Node } from "../lib/miniGL/miniGL.js";
import miniChunks from "../lib/miniGL/miniChunks.js";

import lenseDistortionNode from "../lib/miniGL/miniNodes/effects/lenseDistortionNode.js";
import gaussianBlurNode from "../lib//miniGL/miniNodes/effects/gaussianBlurNode.js";
import bayerDitherNode from "../lib/miniGL/miniNodes/effects/bayerDitherNode.js";

const gl = new miniGL("canvas");
const textCanvas = gl.canvas2D((ctx, w, h) => {
  ctx.fillStyle = "rgba(0, 0, 0, 255)"; // Transparent background
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "white";
  ctx.font = '500 80px "Hubot Sans", "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HELLO miniGL", w / 2, h / 2);
});
const sphereNode = lenseDistortionNode(gl, 1, 0.7, 10, 1.9, true, textCanvas);
const blurNode = gaussianBlurNode(gl, textCanvas, 12);
gl.connect(blurNode, sphereNode, "uTexture");
gl.output(sphereNode);
function animate() {
  gl.render();
  requestAnimationFrame(animate);
}
// const ditherNode = bayerDitherNode(gl);

// gl.connect(sphereNode, ditherNode, "uTexture");

// Ensure fonts are loaded before starting animation
document.fonts.ready.then(() => {
  console.log("Fonts loaded, starting animation");
  animate();
});
