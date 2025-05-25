# miniGL Timeline Animation System

A simple yet powerful keyframe animation system that works alongside miniGL to create smooth transitions between values over time. The Timeline module is a standalone helper that integrates with miniGL's frame-based time system, making it easy to animate properties, uniforms, and even node connections.

## Basic Usage

```javascript
// Import the Timeline module
import { Timeline } from "../lib/miniGL/Timeline.js";

// Create a new timeline
const timeline = new Timeline();

// Basic tween from one value to another
timeline.tween(
  targetObject,    // Object to animate
  'propertyName',  // Property to animate (can use dot notation for nested props)
  fromValue,       // Starting value
  toValue,         // Ending value
  startFrame,      // Starting frame
  durationFrames,  // Duration in frames
  'easing'         // Optional easing function
);

// Start the animation
timeline.play();

// In your animation loop, update the timeline with the current frame
function animate() {
  // Update the timeline with the current frame
  timeline.update(gl.clock);
  
  // Render the frame
  gl.render();
  requestAnimationFrame(animate);
}
```

## Available Methods

### `tween(target, property, from, to, start, duration, easing)`

Create a simple animation between two values.

- `target`: The object to animate (usually a node)
- `property`: The property name to animate (can use dot notation like 'uniforms.color')
- `from`: Starting value
- `to`: Ending value 
- `start`: Starting frame number
- `duration`: Duration in frames
- `easing`: (Optional) Easing function name (default: 'linear')

### `track(target, property, keyframes)`

Add a more complex animation track with multiple keyframes.

- `target`: The object to animate
- `property`: The property name to animate
- `keyframes`: Array of `Keyframe` objects or plain objects with `time` and `value` properties

### `play(startTime = 0)`

Start the timeline from the given start time (in frames).

### `pause()`

Pause the timeline at the current position.

### `stop()`

Stop the timeline and reset to the beginning.

### `setLoop(loop = true)`

Set whether the timeline should loop when it reaches the end.

## Supported Value Types

The timeline can animate:

- **Numbers**: Simple interpolation between values
- **Booleans**: Switch at 50% point
- **Objects with properties**: Interpolates numeric properties individually
- **Special properties**:
  - `_connect`: For dynamically swapping connections (value is an array: [inputName, sourceNode, outputName])
  - `_disconnect`: For removing connections (value is the input name to disconnect)

## Available Easing Functions

- `linear`: Constant speed
- `easeInQuad`: Accelerating from zero velocity
- `easeOutQuad`: Decelerating to zero velocity
- `easeInOutQuad`: Acceleration until halfway, then deceleration
- `easeInCubic`: Accelerating from zero velocity (cubic)
- `easeOutCubic`: Decelerating to zero velocity (cubic)
- `easeInOutCubic`: Acceleration until halfway, then deceleration (cubic)

## Example: Animating Shader Uniforms

```javascript
const node = gl.shader(`...shader code...`, {
  uniforms: {
    color: { x: 1.0, y: 0.0, z: 0.0 },
    opacity: 1.0
  }
});

const timeline = gl.createTimeline();

// Animate color from red to blue
timeline.tween(
  node,
  'uniforms.color',
  { x: 1.0, y: 0.0, z: 0.0 },  // red
  { x: 0.0, y: 0.0, z: 1.0 },  // blue
  0,    // start at frame 0
  60,   // animate over 60 frames
  'easeInOutQuad'
);

// Fade opacity in and out
timeline.tween(node, 'uniforms.opacity', 1.0, 0.0, 60, 30);
timeline.tween(node, 'uniforms.opacity', 0.0, 1.0, 90, 30);

// Loop the animation
timeline.setLoop(true);
timeline.play();
```

## Example: Swapping Node Connections

The timeline can also dynamically swap connections between nodes:

```javascript
// Create nodes
const nodeA = gl.shader(`...`);
const nodeB = gl.shader(`...`);
const nodeC = gl.shader(`...`);
const output = gl.shader(`...`);

// Initial connection
output.connect('glTexture', nodeA);

// Create connection-swapping timeline
const timeline = gl.createTimeline();

// Create keyframes for connection changes
timeline.track(output, '_connect', [
  { time: 60, value: ['glTexture', nodeB, 'default'] },
  { time: 120, value: ['glTexture', nodeC, 'default'] },
  { time: 180, value: ['glTexture', nodeA, 'default'] }
]);

// Loop and play
timeline.setLoop(true);
timeline.play();
```

This will switch the input connection of `output` between the three nodes at the specified frames.

## Combining Multiple Animations

You can add multiple animations to a single timeline to coordinate complex sequences:

```javascript
// Fade out while swapping nodes
timeline.tween(output, 'uniforms.opacity', 1.0, 0.0, 55, 10, 'easeInQuad');
timeline.tween(output, 'uniforms.opacity', 0.0, 1.0, 65, 10, 'easeOutQuad');

timeline.tween(output, 'uniforms.opacity', 1.0, 0.0, 115, 10, 'easeInQuad');
timeline.tween(output, 'uniforms.opacity', 0.0, 1.0, 125, 10, 'easeOutQuad');
```

## Tips and Best Practices

1. **Frame-Based Timing**: Remember that the timeline uses frames, not milliseconds.
2. **Clean Up**: If you no longer need a timeline, you can remove it from the animated nodes.
3. **Multiple Timelines**: You can create multiple independent timelines for different animation groups.
4. **Performance**: Animating many properties at once can impact performance, so use judiciously.
5. **Nesting**: You can animate properties inside nested objects using dot notation. 