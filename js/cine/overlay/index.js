// Cinematic overlay for the browser: plan-cinematic sections 4, 8 and 9, appendix A overlays.
// createOverlay(root, { cards, moods }) -> { load, update, setCash, moneyHold, end }.
// All player text comes from the shot list or the cards data. update(t) is the only clock.
import { BAR_SLIDE, CARD_IN, CARD_OUT, HOLD_SECONDS, barHeight, envelope, dipAlpha, easeOut,
  grainOffset, hexToRgba, fill, active } from './math.js';
import { makeGrainTile } from './grain.js';

const el = (parent, cls, tag = 'div') => {
  const n = document.createElement(tag);
  n.className = cls;
  parent.appendChild(n);
  return n;
};

function box(parent, kind, lines) {
  const b = el(parent, `cine-box cine-${kind}`);
  b.dataset.kind = kind;
  b.hidden = true;
  const parts = lines.map(([cls]) => el(b, `cine-line ${cls}`));
  return { b, parts };
}

// Owner call 45: a caption's 'speaker' (the resolved name, filled by the talk pass) shows as a label
// before the line. A missing, empty or non-text speaker shows no label (narration).
export const speakerName = (cp) => (cp && typeof cp.speaker === 'string' ? cp.speaker.trim() : '');

const reduced = () => document.documentElement.getAttribute('data-reduce-motion') === 'on';

export function createOverlay(root, { cards = {}, moods = [] } = {}) {
  const host = el(root, 'cine-root');
  host.hidden = true;
  const look = el(host, 'cine-layer cine-look');
  const grain = el(host, 'cine-layer cine-grain');
  grain.style.backgroundImage = `url(${makeGrainTile()})`;
  const dip = el(host, 'cine-layer cine-dip');
  const barTop = el(host, 'cine-bar cine-bar-top');
  const barBottom = el(host, 'cine-bar cine-bar-bottom');
  const title = box(host, 'title', [['cine-t56'], ['cine-t24 cine-sub']]);
  const chapter = box(host, 'chapter', [['cine-t24 cine-sub'], ['cine-t56'], ['cine-t24']]);
  const lower = box(host, 'lower', [['cine-t24'], ['cine-t24 cine-sub']]);
  const caption = box(host, 'caption', [['cine-t20 cine-speaker'], ['cine-t24']]); // owner call 45: name, then line
  const holdLine = box(host, 'holdline', [['cine-t24']]);
  const cash = box(host, 'cash', [['cine-t24']]);
  const skip = box(host, 'skip', [['cine-t24']]);
  barTop.dataset.kind = 'bar-top';
  barBottom.dataset.kind = 'bar-bottom';

  const moodById = new Map((Array.isArray(moods) ? moods : []).map((m) => [m.id, m]));
  let overlays = [];
  let mood = null;
  let cashText = '';
  let lastT = 0;
  let apiHold = null;

  const onPress = () => { if (apiHold && apiHold.live) finishHold(); };
  window.addEventListener('keydown', onPress);
  window.addEventListener('pointerdown', onPress);

  function finishHold() {
    if (!apiHold) return;
    const h = apiHold;
    apiHold = null;
    h.live = false;
    h.resolve();
  }

  function setText(parts, values) {
    parts.forEach((p, i) => { const v = values[i] ?? ''; if (p.textContent !== v) p.textContent = v; p.hidden = !v; });
  }

  function show(bx, alpha, slide) {
    bx.b.hidden = alpha <= 0;
    bx.b.style.opacity = String(alpha);
    bx.b.style.transform = slide && !reduced() ? `translateY(${((1 - easeOut(alpha)) * 12).toFixed(2)}px)` : '';
  }

  function cardAlpha(o, t) { return o ? envelope(o, t, CARD_IN, CARD_OUT) : 0; }
  const pick = (type, t) => {
    let found = null;
    for (const o of overlays) if (o.type === type && active(o, t)) found = o;   // latest wins: one at a time
    return found;
  };

  function update(t) {
    lastT = t;
    if (apiHold && apiHold.live && t >= apiHold.at + apiHold.dur) finishHold();
    const W = host.clientWidth || window.innerWidth;
    const H = host.clientHeight || window.innerHeight;
    const unit = Math.min(H / 1080, W / 1920);
    const lb = pick('letterbox', t);
    const rm = reduced();
    let barH = 0;
    if (lb) {
      barH = barHeight(W, H, lb.aspect || 2.39);
      const e = envelope(lb, t, BAR_SLIDE, BAR_SLIDE);
      for (const [bar, sign] of [[barTop, -1], [barBottom, 1]]) {
        bar.style.height = `${barH}px`;
        bar.style.opacity = rm ? String(e) : '1';
        bar.style.transform = rm ? '' : `translateY(${(sign * (1 - easeOut(e)) * 100).toFixed(3)}%)`;
      }
    } else {
      for (const bar of [barTop, barBottom]) { bar.style.opacity = '0'; bar.style.transform = ''; bar.style.height = '0px'; }
    }

    const lookA = lb ? envelope(lb, t, BAR_SLIDE, BAR_SLIDE) : 0;
    if (mood) {
      look.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${mood.vignette ?? 0}) 100%), ${hexToRgba(mood.tint, mood.tintAmount ?? 0)}`;
    }
    look.style.opacity = String(mood ? lookA : 0);
    if (rm || !mood) {
      grain.style.opacity = '0';
      grain.style.transform = '';
    } else {
      const [dx, dy] = grainOffset(t);
      grain.style.opacity = String(Math.min(1, (mood.grain ?? 0) * 2.5) * lookA);
      grain.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    dip.style.opacity = String(dipAlpha(lb, t));

    const tt = pick('title', t);
    setText(title.parts, tt ? [tt.text, tt.sub] : []);
    title.b.style.bottom = `${barH + 64 * unit}px`;
    show(title, cardAlpha(tt, t), true);

    const ch = pick('chapter', t);
    setText(chapter.parts, ch ? [fill(cards.chapter?.number, { n: ch.number }), ch.name, ch.blurb] : []);
    show(chapter, cardAlpha(ch, t), false);

    const lt = pick('lowerThird', t);
    setText(lower.parts, lt ? [lt.name, lt.role] : []);
    lower.b.style.bottom = `${barH + 64 * unit}px`;
    show(lower, cardAlpha(lt, t), true);

    const cp = pick('caption', t);
    setText(caption.parts, cp ? [speakerName(cp), cp.text] : []);
    caption.b.style.bottom = `${barH + 40 * unit}px`;
    show(caption, cardAlpha(cp, t), true);

    const mh = pick('moneyHold', t);
    const hold = mh ? { line: mh.line, alpha: cardAlpha(mh, t) } : apiHold && apiHold.live ? { line: apiHold.line, alpha: 1 } : null;
    setText(holdLine.parts, hold ? [hold.line] : []);
    holdLine.b.style.bottom = `${barH + 40 * unit}px`;
    show(holdLine, hold ? hold.alpha : 0, true);

    cash.parts[0].className = `cine-line ${hold ? 'cine-t48' : 'cine-t24'}`;
    setText(cash.parts, [cashText]);
    const cashOn = !!(cashText && (lb || hold));
    show(cash, cashOn ? 1 : 0, false);
    const sk = pick('skipHint', t);
    setText(skip.parts, sk ? [cards.hints?.skip] : []);
    show(skip, sk ? 1 : 0, false);
    const band = barH > 0 ? barH : 96 * unit;
    cash.parts[0].style.fontSize = '';
    for (const bx of [cash, skip]) {
      if (bx.b.hidden) continue;
      let h = bx.b.offsetHeight;
      if (bx === cash && hold && h > band * 0.9) {   // money is never hidden: fit the large row in its band
        cash.parts[0].style.fontSize = `${((band * 0.9) / 1.2).toFixed(2)}px`;
        h = bx.b.offsetHeight;
      }
      bx.b.style.top = `${Math.min(H - h, H - band + Math.max(0, (band - h) / 2))}px`;
    }
    host.hidden = !lb && !hold && !overlays.some((o) => active(o, t));
  }

  function load(list, form = 'full') {
    finishHold();
    const src = form === 'stinger' && list.stinger ? list.stinger : list;
    overlays = (src.overlays || []).filter((o) => !(form === 'stinger' && o.type === 'letterbox'));
    mood = moodById.get(list.mood) || null;
    host.hidden = false;
    update(0);
  }

  function setCash(text) { cashText = String(text ?? ''); }

  function moneyHold(line) {
    finishHold();
    return new Promise((resolve) => {
      apiHold = { at: lastT, dur: HOLD_SECONDS, line: String(line ?? ''), live: true, resolve };
      update(lastT);
    });
  }

  function end() {
    finishHold();
    overlays = [];
    update(lastT);
    host.hidden = true;
  }

  return { load, update, setCash, moneyHold, end, element: host,
    destroy() { end(); window.removeEventListener('keydown', onPress); window.removeEventListener('pointerdown', onPress); host.remove(); } };
}
