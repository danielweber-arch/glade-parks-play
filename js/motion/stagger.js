// Lists stagger 30 ms an item, 5 items at most: item 6 and later start with item 5. Reduced motion: no stagger.
import { tokens } from './tokens.js';
import { isReduced } from './reduce.js';
import { enter } from './moves.js';

export function delays(count) {
  const t = tokens();
  const out = [];
  for (let i = 0; i < count; i++) out.push(isReduced() ? 0 : Math.min(i, t.staggerMax - 1) * t.stagger);
  return out;
}

export function stagger(items) {
  const list = Array.from(items);
  const d = delays(list.length);
  return list.map((el, i) => enter(el, { delay: d[i] }));
}
