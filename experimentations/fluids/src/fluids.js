import miniGL from "../../../lib/miniGL/miniGL.js";

const gl = new miniGL();

const test = gl.shader(`#version 300 es
    precision highp float;
    uniform float glTime;
    uniform sampler2D uTexture;
    in vec2 glUV;
    out vec4 fragColor;
    void main() {
      vec2 center = vec2(0.5);
      float dist = distance(glUV, center);
      float ripple = sin(dist * 20.0 - glTime * 0.01) * 0.5 + 0.5;
      vec4 tex = texture(uTexture, glUV);
      fragColor = tex;
    }
  `);
const textNode = gl.canvas2D(
  (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    // Draw main text
    ctx.font = "bold 64px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LENS DISTORTION", width / 2, height / 2 - 50);

    // Draw some grid lines for visual reference
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }
  },
  {
    name: "Text Canvas",
  }
);

gl.onResize((width, height) => {
  console.log(width, height);
  textNode.update((ctx) => {
    ctx.clearRect(0, 0, width, height);

    // Draw main text
    ctx.font = "bold 64px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LENS DISTORTION", width / 2, height / 2 - 50);

    // Draw some grid lines for visual reference
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }
  });
});

gl.connect(textNode, test, "uTexture");

gl.output(test);
gl.render();
