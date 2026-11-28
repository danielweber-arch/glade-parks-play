// Motion helpers for the client (P12.6). Attaches by merging onto window.gp, never replacing it.
import * as reduce from './reduce.js';
import { tokens } from './tokens.js';
import { enter, leave, open, close, finishAll, addFinisher, isMotionAnimation } from './moves.js';
import { stagger, delays } from './stagger.js';
import { countUp, countsUp } from './countup.js';

export const motion = {
  tokens, enter, leave, open, close, finishAll, addFinisher, isMotionAnimation, stagger, delays, countUp, countsUp,
  isReduced: reduce.isReduced, getReduceMotion: reduce.getSetting, setReduceMotion: reduce.setSetting, applyReduceMotion: reduce.apply,
};

window.gp = Object.assign(window.gp || {}, {});
window.gp.motion = Object.assign(window.gp.motion || {}, motion);
export default motion;
