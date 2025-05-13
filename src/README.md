# Bubble Refract Effect with miniGL

This demo recreates the "Bubble Refract (Remix)" effect from the original shader JSON export using miniGL.

## What's Included

- **bubble-refract.html**: HTML page with styling and font loading to display the effect
- **bubble-refract.js**: JavaScript implementation of the effect using miniGL

## How It Works

The effect creates a visual resembling a glass lens or bubble that follows your mouse cursor. It implements:

1. A white background layer
2. Text layer with "NEGATIVE FRESNEL" 
3. A bubble/lens effect that:
   - Distorts the content beneath it (spherical lens distortion)
   - Applies chromatic aberration (color separation effect)
   - Follows your mouse cursor

## Node Graph

```
[Background Layer (White)]  [Text Canvas]
          |                     |
          v                     v
          +-------->[Text Shader]
                         |
                         v
                   [Bubble Shader]
                         |
                         v
                      Output
```

## Implementation Details

- The code uses miniGL's node-based architecture to connect different shaders
- The spherical transformation creates the lens effect
- Chromatic aberration creates the rainbow-like color separation
- Mouse tracking allows the bubble to follow cursor movement

## How to Run

Open `bubble-refract.html` in a web browser that supports WebGL2. Move your mouse around the canvas to see the bubble effect follow your cursor.

## Original Source

This effect is based on a shader configuration exported from another tool, as provided in `src/test.json`. 