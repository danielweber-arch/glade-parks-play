// P7.7 part B and C: the details card (owner call 44) and the live site report. Both come whole from the host
// (/api/build/card, /api/build/report, built by Sim/BuildView); the client only lays the strings out.
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function wireCard(root, getJson) {
  const card = root.querySelector('[data-build-details]');
  const report = root.querySelector('[data-build-report]');
  async function show(id) {
    if (!id) { card.hidden = true; card.innerHTML = ''; return; }
    const c = await getJson('/api/build/card?id=' + encodeURIComponent(id)).catch(() => null);
    if (!c) { card.hidden = true; return; }
    const row = (k, label, v) => `<dt>${esc(label)}</dt><dd data-card-${k}>${esc(v)}</dd>`;
    card.innerHTML = `<h3 data-card-name>${esc(c.name)}</h3><dl>${row('type', c.typeLabel, c.typeName)}${row('tier', c.tierLabel, c.tier)}`
      + `${row('tenants', c.tenantsLabel, c.tenants)}${row('rent', c.rentLabel, c.rent)}${row('value', c.valueLabel, c.value)}</dl>`
      + (c.estimateNote ? `<p class="build-card-note" data-card-note>${esc(c.estimateNote)}</p>` : '');
    card.hidden = false;
  }
  async function refresh() {
    const r = await getJson('/api/build/report').catch(() => null);
    if (!r) return;
    report.innerHTML = `<h3>${esc(r.title)}</h3><dl><dt>${esc(r.buildingsLabel)}</dt><dd data-report-buildings>${r.buildings}</dd>`
      + `<dt>${esc(r.leasedLabel)}</dt><dd data-report-leased>${esc(r.leased)}</dd><dt>${esc(r.cashLabel)}</dt><dd data-report-cash>${esc(r.cash)}</dd></dl>`;
    report.dataset.buildings = String(r.buildings);
  }
  root.addEventListener('build:changed', refresh);
  window.addEventListener('gp:quarter', refresh); // a quarter end elsewhere in the page can ask for a refresh
  return { show, refresh };
}
