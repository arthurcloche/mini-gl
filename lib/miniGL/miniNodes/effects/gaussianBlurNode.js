export const gaussianBlurShader = (isVertical = false) => `#version 300 es
precision highp float;
in vec2 glUV;
uniform sampler2D uTexture;
uniform vec2 glResolution;
uniform vec2 glPixel;

uniform float uSigma;
uniform float uRadius;

out vec4 fragColor;

float gaussian(float x, float sigma) {
  return exp(-0.5 * (x * x) / (sigma * sigma)) / (sigma * sqrt(6.2831853));
}

void main() {

  vec2 texel = glPixel;
  float sigma = uSigma;
  int kernelSize = 2 * int(floor(4. * sigma + .5)) + 1;
    
    float weightSum = 0.;
    fragColor *= 0.;
    for (int i = 0; i < kernelSize; i++)
    {
        float x = float(i) - (float(kernelSize) * .5);
        float weight = exp(-(x * x) / (2.0 * sigma * sigma));
        weightSum += weight;
        
        fragColor += texture(uTexture, glUV + ${
          isVertical ? "vec2(0., x * texel.y)" : "vec2(x * texel.x, 0.)"
        }) * weight;
    }
    fragColor /= weightSum;
    
}
`;

export default function gaussianBlurNode(
  gl,
  target = gl.TransparentPixel,
  sigma = 4.0,
  radius = 8.0,
  name = "Gaussian Blur Node"
) {
  const uniforms = {
    uTexture: { texture: gl.TransparentPixel },
    uSigma: sigma,
    uRadius: radius,
  };

  // Horizontal blur node
  const blurH = gl.shader(gaussianBlurShader(false), {
    name: name + " (Horizontal)",
    uniforms: { ...uniforms },
  });
  gl.connect(target, blurH, "uTexture");
  // Vertical blur node
  const blurV = gl.shader(gaussianBlurShader(true), {
    name: name + " (Vertical)",
    uniforms: { ...uniforms },
  });
  gl.connect(blurH, blurV, "uTexture");

  return blurV;
}
