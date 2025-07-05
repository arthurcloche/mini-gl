import React, { useRef, useState, useEffect } from "react";
import { useMiniGL } from "../useMiniGL.js";

// Subtle iridescent shader for brand elements
const brandShader = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform float glTime;
uniform vec2 glResolution;
uniform vec3 glMouse;
uniform float uIntensity;
uniform float uSpeed;
uniform vec3 uBrandColor;

in vec2 glUV;
out vec4 fragColor;

// Simplified noise for subtle effects
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// HSV conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = glUV;
  
  // Sample original texture
  vec4 original = texture(uTexture, uv);
  
  // Subtle animated noise
  float time = glTime * uSpeed;
  vec2 noiseCoord = uv * 3.0 + time * 0.1;
  float n1 = noise(noiseCoord);
  float n2 = noise(noiseCoord * 1.7 + 100.0);
  
  // Mouse proximity for interactive shimmer
  float mouseDist = length(uv - glMouse.xy);
  float mouseEffect = 1.0 - smoothstep(0.0, 0.6, mouseDist);
  
  // Create subtle hue shift
  float hueShift = (n1 * 0.3 + n2 * 0.2) * uIntensity + mouseEffect * 0.1;
  
  // Convert to HSV, apply shift, convert back
  vec3 rgb = original.rgb;
  float maxVal = max(max(rgb.r, rgb.g), rgb.b);
  float minVal = min(min(rgb.r, rgb.g), rgb.b);
  float delta = maxVal - minVal;
  
  float hue = 0.0;
  if (delta > 0.0) {
    if (maxVal == rgb.r) {
      hue = (rgb.g - rgb.b) / delta;
    } else if (maxVal == rgb.g) {
      hue = 2.0 + (rgb.b - rgb.r) / delta;
    } else {
      hue = 4.0 + (rgb.r - rgb.g) / delta;
    }
    hue /= 6.0;
  }
  
  float saturation = maxVal > 0.0 ? delta / maxVal : 0.0;
  float value = maxVal;
  
  // Apply subtle hue shift toward brand colors
  hue = fract(hue + hueShift);
  
  // Enhance with brand color
  vec3 shifted = hsv2rgb(vec3(hue, saturation * 1.2, value));
  vec3 branded = mix(shifted, uBrandColor, 0.1 * uIntensity);
  
  // Blend based on luminance for natural look
  float luminance = dot(original.rgb, vec3(0.299, 0.587, 0.114));
  float blendFactor = smoothstep(0.2, 0.8, luminance) * uIntensity * 0.6;
  
  vec3 finalColor = mix(original.rgb, branded, blendFactor);
  
  // Add subtle shimmer highlight
  float shimmer = mouseEffect * 0.3 + (n1 * 0.1);
  finalColor += shimmer * uBrandColor * uIntensity;
  
  fragColor = vec4(finalColor, original.a);
}`;

// Hero gradient shader
const heroShader = `#version 300 es
precision highp float;

uniform float glTime;
uniform vec2 glResolution;
uniform vec3 glMouse;

in vec2 glUV;
out vec4 fragColor;

void main() {
  vec2 uv = glUV;
  
  // Create flowing gradient
  float time = glTime * 0.2;
  vec2 center = vec2(0.5) + vec2(sin(time), cos(time * 0.7)) * 0.1;
  float dist = length(uv - center);
  
  // Mouse interaction
  float mouseDist = length(uv - glMouse.xy);
  float mouseEffect = 1.0 - smoothstep(0.0, 0.5, mouseDist);
  
  // Luxury color palette
  vec3 color1 = vec3(0.95, 0.85, 0.9);  // Rose gold
  vec3 color2 = vec3(0.9, 0.7, 0.8);    // Dusty rose
  vec3 color3 = vec3(0.8, 0.6, 0.9);    // Lavender
  
  // Gradient mixing
  float factor1 = sin(dist * 8.0 + time * 2.0) * 0.5 + 0.5;
  float factor2 = cos(uv.x * 6.0 + time) * 0.5 + 0.5;
  
  vec3 gradient = mix(color1, color2, factor1);
  gradient = mix(gradient, color3, factor2 * 0.3);
  
  // Add mouse interaction glow
  gradient += mouseEffect * vec3(1.0, 0.8, 0.9) * 0.2;
  
  fragColor = vec4(gradient, 0.95);
}`;

function CosmeticBrand() {
  const heroCanvasRef = useRef();
  const product1Ref = useRef();
  const product2Ref = useRef();
  const product3Ref = useRef();

  // Brand animation state
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });

  // Hero background effect
  const { isReady: heroReady } = useMiniGL(
    heroCanvasRef,
    (gl) => {
      const heroNode = gl.shader(heroShader, {}, { name: "HeroGradient" });
      gl.output(heroNode);
      return { hero: heroNode };
    },
    []
  );

  // Product image effects
  const setupProductEffect = (canvasRef, productImage, brandColor) => {
    return useMiniGL(
      canvasRef,
      (gl) => {
        if (!productImage) {
          // Placeholder
          const placeholderShader = `#version 300 es
          precision highp float;
          uniform float glTime;
          in vec2 glUV;
          out vec4 fragColor;
          void main() {
            vec2 uv = glUV;
            float pulse = sin(glTime + uv.x * 10.0) * 0.5 + 0.5;
            vec3 color = mix(vec3(0.9, 0.8, 0.85), vec3(0.95, 0.9, 0.9), pulse);
            fragColor = vec4(color, 1.0);
          }`;
          const placeholder = gl.shader(
            placeholderShader,
            {},
            { name: "ProductPlaceholder" }
          );
          gl.output(placeholder);
          return { placeholder };
        }

        const imageNode = gl.image(productImage, { name: "ProductImage" });
        const effectNode = gl.shader(
          brandShader,
          {
            uIntensity: 0.4,
            uSpeed: 0.3,
            uBrandColor: {
              x: brandColor[0],
              y: brandColor[1],
              z: brandColor[2],
            },
          },
          { name: "ProductEffect" }
        );

        effectNode.connect("uTexture", imageNode);
        gl.output(effectNode);

        return { image: imageNode, effect: effectNode };
      },
      [productImage, brandColor]
    );
  };

  // Product placeholders (you'd replace these with actual product images)
  const product1Effect = setupProductEffect(
    product1Ref,
    null,
    [0.95, 0.7, 0.8]
  );
  const product2Effect = setupProductEffect(
    product2Ref,
    null,
    [0.9, 0.8, 0.95]
  );
  const product3Effect = setupProductEffect(
    product3Ref,
    null,
    [0.85, 0.9, 0.8]
  );

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Hero Section */}
      <section
        style={{
          position: "relative",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Background Canvas */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
          }}
        >
          <div ref={heroCanvasRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Hero Content */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            color: "#2c2c2c",
            maxWidth: "800px",
            padding: "0 40px",
          }}
        >
          <h1
            style={{
              fontSize: "4.5rem",
              fontWeight: "300",
              letterSpacing: "0.1em",
              margin: "0 0 30px 0",
              textShadow: "0 2px 20px rgba(255,255,255,0.8)",
            }}
          >
            LUMIÈRE
          </h1>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: "300",
              letterSpacing: "0.05em",
              margin: "0 0 50px 0",
              opacity: 0.9,
            }}
          >
            Discover the art of radiant beauty
          </p>
          <button
            style={{
              background:
                "linear-gradient(135deg, rgba(220, 180, 200, 0.9), rgba(200, 160, 220, 0.9))",
              border: "none",
              padding: "18px 50px",
              fontSize: "1.1rem",
              fontWeight: "500",
              letterSpacing: "0.1em",
              borderRadius: "30px",
              color: "#fff",
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              transition: "all 0.3s ease",
              textTransform: "uppercase",
            }}
          >
            Explore Collection
          </button>
        </div>
      </section>

      {/* Products Section */}
      <section
        style={{
          padding: "120px 40px",
          background: "linear-gradient(180deg, #fafafa 0%, #fff 100%)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <h2
              style={{
                fontSize: "3rem",
                fontWeight: "300",
                letterSpacing: "0.05em",
                color: "#2c2c2c",
                margin: "0 0 20px 0",
              }}
            >
              Signature Collection
            </h2>
            <p
              style={{
                fontSize: "1.2rem",
                color: "#666",
                fontWeight: "300",
                maxWidth: "600px",
                margin: "0 auto",
              }}
            >
              Each product is crafted with precision and infused with our
              signature iridescent technology
            </p>
          </div>

          {/* Product Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "60px",
              marginTop: "80px",
            }}
          >
            {/* Product 1 */}
            <div
              style={{
                background: "#fff",
                borderRadius: "20px",
                padding: "40px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                textAlign: "center",
                transition: "transform 0.3s ease",
              }}
            >
              <div
                style={{
                  width: "280px",
                  height: "280px",
                  margin: "0 auto 30px auto",
                  borderRadius: "15px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  ref={product1Ref}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "400",
                  letterSpacing: "0.05em",
                  color: "#2c2c2c",
                  margin: "0 0 15px 0",
                }}
              >
                Radiant Glow Serum
              </h3>
              <p
                style={{
                  color: "#666",
                  fontSize: "1rem",
                  lineHeight: "1.6",
                  margin: "0 0 25px 0",
                }}
              >
                Illuminating serum with pearl essence for a natural luminous
                finish
              </p>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "500",
                  color: "#c49991",
                }}
              >
                $125
              </div>
            </div>

            {/* Product 2 */}
            <div
              style={{
                background: "#fff",
                borderRadius: "20px",
                padding: "40px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                textAlign: "center",
                transition: "transform 0.3s ease",
              }}
            >
              <div
                style={{
                  width: "280px",
                  height: "280px",
                  margin: "0 auto 30px auto",
                  borderRadius: "15px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  ref={product2Ref}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "400",
                  letterSpacing: "0.05em",
                  color: "#2c2c2c",
                  margin: "0 0 15px 0",
                }}
              >
                Prismatic Highlighter
              </h3>
              <p
                style={{
                  color: "#666",
                  fontSize: "1rem",
                  lineHeight: "1.6",
                  margin: "0 0 25px 0",
                }}
              >
                Multi-dimensional highlighting powder with color-shifting
                pigments
              </p>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "500",
                  color: "#c49991",
                }}
              >
                $68
              </div>
            </div>

            {/* Product 3 */}
            <div
              style={{
                background: "#fff",
                borderRadius: "20px",
                padding: "40px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                textAlign: "center",
                transition: "transform 0.3s ease",
              }}
            >
              <div
                style={{
                  width: "280px",
                  height: "280px",
                  margin: "0 auto 30px auto",
                  borderRadius: "15px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  ref={product3Ref}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "400",
                  letterSpacing: "0.05em",
                  color: "#2c2c2c",
                  margin: "0 0 15px 0",
                }}
              >
                Aurora Lip Gloss
              </h3>
              <p
                style={{
                  color: "#666",
                  fontSize: "1rem",
                  lineHeight: "1.6",
                  margin: "0 0 25px 0",
                }}
              >
                High-shine lip gloss with holographic finish and nourishing oils
              </p>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: "500",
                  color: "#c49991",
                }}
              >
                $42
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Story Section */}
      <section
        style={{
          padding: "120px 40px",
          background: "linear-gradient(135deg, #f8f6f8 0%, #f0f0f5 100%)",
        }}
      >
        <div
          style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}
        >
          <h2
            style={{
              fontSize: "2.5rem",
              fontWeight: "300",
              letterSpacing: "0.05em",
              color: "#2c2c2c",
              margin: "0 0 40px 0",
            }}
          >
            The Science of Luminosity
          </h2>
          <p
            style={{
              fontSize: "1.3rem",
              lineHeight: "1.8",
              color: "#555",
              fontWeight: "300",
              maxWidth: "800px",
              margin: "0 auto",
            }}
          >
            Our patented iridescent technology captures and reflects light at
            multiple wavelengths, creating a natural luminosity that adapts to
            your skin tone and the surrounding environment. Each formula is
            enriched with light-reflecting microspheres and color-shifting
            pigments for an otherworldly glow.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: "#2c2c2c",
          color: "#fff",
          padding: "60px 40px 40px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h3
            style={{
              fontSize: "2rem",
              fontWeight: "300",
              letterSpacing: "0.1em",
              margin: "0 0 30px 0",
            }}
          >
            LUMIÈRE
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "40px",
              marginBottom: "40px",
              flexWrap: "wrap",
            }}
          >
            <a
              href="#"
              style={{
                color: "#ccc",
                textDecoration: "none",
                fontSize: "1rem",
              }}
            >
              Products
            </a>
            <a
              href="#"
              style={{
                color: "#ccc",
                textDecoration: "none",
                fontSize: "1rem",
              }}
            >
              About
            </a>
            <a
              href="#"
              style={{
                color: "#ccc",
                textDecoration: "none",
                fontSize: "1rem",
              }}
            >
              Contact
            </a>
            <a
              href="#"
              style={{
                color: "#ccc",
                textDecoration: "none",
                fontSize: "1rem",
              }}
            >
              Store Locator
            </a>
          </div>
          <p style={{ color: "#999", fontSize: "0.9rem", margin: 0 }}>
            © 2024 Lumière Cosmetics. Crafted with precision and passion.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default CosmeticBrand;
