/**
 * Timeline.js - Animation timeline for miniGL
 * Simple keyframe animation system that works with miniGL's frame-based timing
 */

export class Keyframe {
  constructor(time, value, easing = "linear") {
    this.time = time;
    this.value = value;
    this.easing = easing;
  }
}

export class Timeline {
  constructor() {
    this.tracks = new Map();
    this.isPlaying = false;
    this.startTime = 0;
    this.currentTime = 0;
    this.duration = 0;
    this.loop = false;
  }

  // Add a keyframe track for a property
  track(target, property, keyframes = []) {
    const trackId = `${target.id || "anon"}_${property}`;
    if (!this.tracks.has(trackId)) {
      this.tracks.set(trackId, {
        target,
        property,
        keyframes: [],
        lastValue: undefined,
      });
    }

    const track = this.tracks.get(trackId);

    // Add keyframes and sort by time
    track.keyframes = [...track.keyframes, ...keyframes].sort(
      (a, b) => a.time - b.time
    );

    // Update duration based on the last keyframe
    if (track.keyframes.length > 0) {
      const lastKeyframeTime = track.keyframes[track.keyframes.length - 1].time;
      this.duration = Math.max(this.duration, lastKeyframeTime);
    }

    return this;
  }

  // Simple way to define a tween
  tween(target, property, from, to, start, duration, easing = "linear") {
    return this.track(target, property, [
      new Keyframe(start, from, easing),
      new Keyframe(start + duration, to, easing),
    ]);
  }

  // Play the timeline
  play(startTime = 0) {
    this.isPlaying = true;
    this.startTime = startTime;
    this.currentTime = startTime;
    return this;
  }

  // Pause the timeline
  pause() {
    this.isPlaying = false;
    return this;
  }

  // Stop and reset the timeline
  stop() {
    this.isPlaying = false;
    this.currentTime = 0;
    return this;
  }

  // Toggle loop
  setLoop(loop = true) {
    this.loop = loop;
    return this;
  }

  // Update the timeline with the current time
  update(time) {
    if (!this.isPlaying) return;

    this.currentTime = time - this.startTime;

    // Loop if enabled
    if (this.loop && this.currentTime > this.duration) {
      this.startTime = time - (this.currentTime % this.duration);
      this.currentTime = this.currentTime % this.duration;
    } else if (!this.loop && this.currentTime > this.duration) {
      this.isPlaying = false;
      this.currentTime = this.duration;
    }

    // Process all tracks
    for (const track of this.tracks.values()) {
      const value = this._evaluateTrack(track, this.currentTime);
      if (value !== undefined && value !== track.lastValue) {
        // Handle special properties
        if (track.property === "_connect" && Array.isArray(value)) {
          // Handle dynamic connections: [inputName, sourceNode, outputName]
          track.target.connect(value[0], value[1], value[2] || "default");
        } else if (
          track.property === "_disconnect" &&
          typeof value === "string"
        ) {
          // Handle disconnection
          track.target.disconnect(value);
        } else {
          // Regular property updates
          if (track.property.includes(".")) {
            // Handle nested properties like uniforms.myValue
            const parts = track.property.split(".");
            let obj = track.target;
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;

            // Special case for updating uniforms in shader nodes
            if (parts[0] === "uniforms" && track.target.updateUniform) {
              track.target.updateUniform(parts[1], value);
            }
          } else {
            track.target[track.property] = value;
          }
        }

        track.lastValue = value;
      }
    }

    return this;
  }

  // Evaluate a track at a specific time
  _evaluateTrack(track, time) {
    const { keyframes } = track;

    // No keyframes
    if (keyframes.length === 0) return undefined;

    // Before first keyframe
    if (time <= keyframes[0].time) return keyframes[0].value;

    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time)
      return keyframes[keyframes.length - 1].value;

    // Find keyframes that surround the current time
    let i = 0;
    while (i < keyframes.length - 1 && time > keyframes[i + 1].time) {
      i++;
    }

    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];

    // Calculate interpolation factor
    const t = (time - k1.time) / (k2.time - k1.time);

    // Apply easing
    const easedT = this._applyEasing(t, k1.easing);

    // Interpolate based on value type
    return this._interpolate(k1.value, k2.value, easedT);
  }

  // Apply easing function
  _applyEasing(t, easingName) {
    switch (easingName) {
      case "linear":
        return t;
      case "easeInQuad":
        return t * t;
      case "easeOutQuad":
        return t * (2 - t);
      case "easeInOutQuad":
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case "easeInCubic":
        return t * t * t;
      case "easeOutCubic":
        return --t * t * t + 1;
      case "easeInOutCubic":
        return t < 0.5
          ? 4 * t * t * t
          : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      default:
        return t;
    }
  }

  // Interpolate between values based on type
  _interpolate(a, b, t) {
    // Handle booleans
    if (typeof a === "boolean" && typeof b === "boolean") {
      return t >= 0.5 ? b : a;
    }

    // Handle numbers
    if (typeof a === "number" && typeof b === "number") {
      return a + (b - a) * t;
    }

    // Handle objects with x, y, z properties (vectors)
    if (
      typeof a === "object" &&
      typeof b === "object" &&
      a !== null &&
      b !== null
    ) {
      const result = {};
      for (const key in a) {
        if (
          key in b &&
          typeof a[key] === "number" &&
          typeof b[key] === "number"
        ) {
          result[key] = a[key] + (b[key] - a[key]) * t;
        } else {
          result[key] = key in b ? b[key] : a[key];
        }
      }
      return result;
    }

    // For other types, switch at midpoint
    return t < 0.5 ? a : b;
  }
}
