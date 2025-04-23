/**
 * miniGL - A minimal WebGL2 rendering pipeline for fragment shader effects
 */
import miniGL from "./miniGL.js";
import {
  createDitherEffect,
  createMouseBulgeEffect,
  applyEffectToMiniGL,
} from "./effects.js";

export {
  miniGL,
  // Effect factories
  createDitherEffect,
  createMouseBulgeEffect,
  applyEffectToMiniGL,
};

export default miniGL;
