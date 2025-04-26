// Shader function libraries for miniGL
const miniChunks = {
  // Noise functions
  noise: {
    random: `
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
    `,
    noise: `
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);

        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        // Smooth interpolation
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(a, b, u.x) +
              (c - a)* u.y * (1.0 - u.x) +
              (d - b) * u.x * u.y;
      }
    `,
    fbm: `
      float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(st * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
    `,
  },

  // Blend modes
  blend: {
    normal: `
      vec4 blend_normal(vec4 base, vec4 blend) {
        return mix(base, blend, blend.a);
      }
    `,
    multiply: `
      vec4 blend_multiply(vec4 base, vec4 blend) {
        vec4 result = base * blend;
        return mix(base, result, blend.a);
      }
    `,
    screen: `
      vec4 blend_screen(vec4 base, vec4 blend) {
        vec4 result = vec4(1.0) - ((vec4(1.0) - base) * (vec4(1.0) - blend));
        return mix(base, result, blend.a);
      }
    `,
    add: `
      vec4 blend_add(vec4 base, vec4 blend) {
        vec4 result = min(base + blend, 1.0);
        return mix(base, result, blend.a);
      }
    `,
    overlay: `
      float blendOverlay(float base, float blend) {
        return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
      }
      
      vec4 blend_overlay(vec4 base, vec4 blend) {
        vec4 result;
        result.r = blendOverlay(base.r, blend.r);
        result.g = blendOverlay(base.g, blend.g);
        result.b = blendOverlay(base.b, blend.b);
        result.a = base.a;
        return mix(base, result, blend.a);
      }
    `,
  },

  // Color utils
  color: {
    hsv: `
      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
    `,
    hsl: `
      vec3 rgb2hsl(vec3 c) {
        float cmin = min(min(c.r, c.g), c.b);
        float cmax = max(max(c.r, c.g), c.b);
        float delta = cmax - cmin;
        float h = 0.0;
        float s = 0.0;
        float l = (cmax + cmin) / 2.0;
        
        if (delta > 0.0) {
          s = l < 0.5 ? delta / (cmax + cmin) : delta / (2.0 - cmax - cmin);
          
          if (c.r == cmax) {
            h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
          } else if (c.g == cmax) {
            h = (c.b - c.r) / delta + 2.0;
          } else {
            h = (c.r - c.g) / delta + 4.0;
          }
          h /= 6.0;
        }
        
        return vec3(h, s, l);
      }

      vec3 hsl2rgb(vec3 c) {
        if (c.y == 0.0) return vec3(c.z);
        
        float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
        float p = 2.0 * c.z - q;
        
        return vec3(
          hue2rgb(p, q, c.x + 1.0/3.0),
          hue2rgb(p, q, c.x),
          hue2rgb(p, q, c.x - 1.0/3.0)
        );
      }

      float hue2rgb(float p, float q, float t) {
        if (t < 0.0) t += 1.0;
        if (t > 1.0) t -= 1.0;
        if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0/2.0) return q;
        if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
        return p;
      }
    `,
  },

  // Math utils
  math: {
    constants: `
      const float PI = 3.14159265359;
      const float TWO_PI = 6.28318530718;
      const float HALF_PI = 1.57079632679;
    `,

    rotation: `
      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      mat3 rotateX(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
          1.0, 0.0, 0.0,
          0.0, c, -s,
          0.0, s, c
        );
      }

      mat3 rotateY(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
          c, 0.0, s,
          0.0, 1.0, 0.0,
          -s, 0.0, c
        );
      }

      mat3 rotateZ(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat3(
          c, -s, 0.0,
          s, c, 0.0,
          0.0, 0.0, 1.0
        );
      }
    `,
  },
};

export default miniChunks;
