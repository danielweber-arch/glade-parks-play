// Moves focus among the panel's actions and presses them. Left and right step
// in DOM order; up and down step by one grid row when the actions sit in a
// grid (Home), else by one. On a number input, up and down step the value and
// Submit sends it, so a controller alone can answer a number screen.
// Intents: up, down, left, right, submit, cancel, phone.
export function createFocus(panel) {
  // [data-client] is a client side button (Sound and scenes entry): it moves and presses like an action but is
  // not a Sim action, so specs and code that read `[data-action]` see the Sim menu unchanged.
  const items = () => [...panel.querySelectorAll('[data-action], [data-number], [data-client]')];
  const off = (n) => n.getAttribute('aria-disabled') === 'true';
  function cols(node) {
    const p = node && node.parentElement;
    if (!p || getComputedStyle(p).display !== 'grid') return 1;
    return getComputedStyle(p).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  }
  // Owner call 96 (N403): Left and Right wrap at the ends, so they reach every button on the screen, the client bar
  // included. Up and Down keep their grid row moves and do not wrap.
  function move(step, wrap) {
    const list = items();
    if (!list.length) return;
    let i = list.indexOf(document.activeElement);
    const n = list.length;
    if (wrap && i >= 0) {
      const dir = step < 0 ? -1 : 1;
      for (let k = 0; k < n; k++) { i = (i + dir + n) % n; if (!off(list[i])) { list[i].focus(); return; } }
      return;
    }
    i = i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + step));
    // An off button (Start's Continue with nothing to continue) is not a focus stop: keep going the same way.
    const dir = step < 0 ? -1 : 1;
    while (off(list[i]) && i + dir >= 0 && i + dir < list.length) i += dir;
    if (off(list[i]) && step !== 0) return; // nothing pressable that way: stay put
    list[i].focus();
  }
  // N370 root cause: Home's actions sit in a 2 column grid under the 3 button client bar, so Up from the first
  // action stepped back 2 items and landed on City map, not Sound and scenes. Up or down that leaves the grid now
  // lands on the nearest item outside it (the bar's last button going up), and steps by a row only inside it.
  function rowMove(dir, a) {
    const n = a ? cols(a) : 1;
    if (n <= 1) return move(dir);
    const list = items();
    const i = list.indexOf(a);
    const t = list[i + dir * n];
    if (t && t.parentElement === a.parentElement) return move(dir * n);
    let j = i;
    while (list[j + dir] && list[j + dir].parentElement === a.parentElement) j += dir;
    return list[j + dir] ? move(j + dir - i) : undefined;
  }
  function stepNumber(input, by) {
    const n = parseInt(input.value.replace(/[^0-9]/g, ''), 10) || 0;
    input.value = String(Math.max(0, n + by));
  }
  // N357 (audit M2): an open overlay takes the intents. The city map: arrows step its buttons (fast travel, Drive,
  // Close), Submit presses, Back closes. 3D build handles its own keys, so the panel stays still under it.
  function overlay(name) {
    if (document.querySelector('[data-build]')) return true;
    const city = document.querySelector('[data-city]');
    if (!city) return false;
    const list = [...city.querySelectorAll('button')].filter((b) => !b.disabled);
    if (!list.length) return true;
    const a = document.activeElement; let i = list.indexOf(a);
    if (name === 'cancel') { const c = city.querySelector('[data-city-close]'); if (c) c.click(); return true; }
    if (name === 'submit') { if (i >= 0) a.click(); else list[0].focus(); return true; }
    const step = name === 'left' || name === 'up' ? -1 : name === 'right' || name === 'down' ? 1 : 0;
    if (step) list[i < 0 ? 0 : Math.min(list.length - 1, Math.max(0, i + step))].focus();
    return true;
  }
  function intent(name) {
    if (overlay(name)) return;
    const a = document.activeElement;
    const inPanel = a && panel.contains(a);
    const onNumber = inPanel && a.matches('[data-number]');
    if (onNumber && (name === 'up' || name === 'down')) return stepNumber(a, name === 'up' ? 1 : -1);
    if (name === 'left') return move(-1, inPanel);
    if (name === 'right') return move(1, inPanel);
    if (name === 'up' || name === 'down') return rowMove(name === 'up' ? -1 : 1, inPanel ? a : null);
    if (name === 'submit') {
      if (onNumber) { const ok = panel.querySelector('[data-action="number-submit"]'); if (ok) ok.click(); return; }
      if (inPanel && a.matches('[data-action], [data-client]')) a.click();
      else if (!inPanel) move(0);
      return;
    }
    if (name === 'cancel') { const b = panel.querySelector('[data-back="true"]'); if (b) b.click(); return; }
    if (name === 'phone' && panel.getAttribute('data-screen') === 'home') {
      // Owner call 39: Phone sits under Home, More. Press Phone if Home still shows it, else More and then Phone.
      if (pressLabel(phoneWord(panel))) return;
      const from = panel.getAttribute('data-screen');
      if (!pressLabel(moreWord(panel))) return;
      const seen = new MutationObserver(() => {
        if (panel.getAttribute('data-screen') === from) return;
        seen.disconnect();
        pressLabel(phoneWord(panel));
      });
      seen.observe(panel, { attributes: true, attributeFilter: ['data-screen'] });
      setTimeout(() => seen.disconnect(), 5000); // no reply: stop waiting
    }
  }
  function pressLabel(word) {
    const b = items().find((x) => x.matches('[data-action]') && (x.querySelector('.lbl') || x).textContent.trim() === word);
    if (b) b.click();
    return !!b;
  }
  return { intent, move };
}

// The Phone word comes from the Reply: the home action labelled Phone.
function phoneWord(panel) {
  return panel.dataset.phoneWord || 'Phone';
}
// The More word on Home (owner call 39); a host may set data-more-word.
function moreWord(panel) {
  return panel.dataset.moreWord || 'More';
}
