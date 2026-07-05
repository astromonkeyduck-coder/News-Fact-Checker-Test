/**
 * Noteworthy News V2 - Synthesized UI sound effects (Web Audio API)
 *
 * Backward-compatible shim over sfx-engine.js for existing imports.
 */

import { NoteworthySFX, initSFX } from './sfx-engine.js';

export { initSFX };

export const UISounds = {
  tap() {
    NoteworthySFX.play('nav-select');
  },
  success() {
    NoteworthySFX.play('success');
  },
  error() {
    NoteworthySFX.play('error');
  },
  notify() {
    NoteworthySFX.play('notify');
  },
  sweep() {
    NoteworthySFX.play('sweep');
  },
  flashlight(isOn) {
    NoteworthySFX.play('flashlight', { value: isOn });
  },
  toggle(isOn) {
    NoteworthySFX.play('toggle', { value: isOn });
  },
};

export { NoteworthySFX };
