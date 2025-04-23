// Core components
import MiniGL, { MiniGLContext, PassRegistryContext } from "./miniGL.jsx";

// Hooks
import {
  useMiniGL,
  usePassRegistry,
  useShaderPass,
  usePingPongPass,
  useTexture,
  useRenderTarget,
} from "./hooks.jsx";

// Components
import {
  Pass,
  PingPongPass,
  Canvas,
  Image,
  Effect,
  DitherEffect,
  MouseBulgeEffect,
} from "./EffectComponents.jsx";

// Effect factories for both JS and React
import {
  createDitherEffect,
  createMouseBulgeEffect,
  applyEffectToMiniGL,
} from "../js/effects.js";

// Examples
import { ReactMiniGLExample, VanillaAPIExample } from "./Example.jsx";

export {
  // Core
  MiniGL,
  MiniGLContext,
  PassRegistryContext,

  // Hooks
  useMiniGL,
  usePassRegistry,
  useShaderPass,
  usePingPongPass,
  useTexture,
  useRenderTarget,

  // Components
  Pass,
  PingPongPass,
  Canvas,
  Image,

  // Effect components
  Effect,
  DitherEffect,
  MouseBulgeEffect,

  // Effect factories
  createDitherEffect,
  createMouseBulgeEffect,
  applyEffectToMiniGL,

  // Examples
  ReactMiniGLExample,
  VanillaAPIExample,
};

export default MiniGL;
