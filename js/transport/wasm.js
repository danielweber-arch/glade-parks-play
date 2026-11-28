// WebAssembly backend: the real sim compiled by Web/Wasm (see Docs/agent-notes/wasm-plan.md).
// Same interface as http.js. Boot loads _framework/dotnet.js and data-pack.json once, then calls Init.
// Any failure becomes a Reply with ok false and one plain line, never a throw.
import { failReply } from './http.js';

// Exports whose reply can follow a save write (a Save press runs inside Act; quarter end and commands can autosave).
const WRITES = new Set(['NewGame', 'Load', 'Save', 'EndQuarter', 'Command', 'Act', 'CreateDeveloper']);
// Part 2 (r58-i5): browser saves live in localStorage under one key, as {name: save text}. Every read and write is in
// try/catch (a private window or blocked storage just means no saves carry over).
export const SAVES_KEY = 'gp-saves-v1';
export function readStoredSaves(store) {
  try { const t = store && store.getItem(SAVES_KEY); const o = t ? JSON.parse(t) : null; return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  catch (e) { console.error('[wasm] stored saves unreadable', e); return {}; }
}
function browserStore() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { console.error('[wasm] no localStorage', e); return null; } }

// The save to download: the one with the latest savedAt in its header, else the last name in order.
function newest(all) {
  let best = null, at = '';
  for (const [k, t] of Object.entries(all || {})) {
    let when = '';
    try { const j = JSON.parse(t); when = String((j && (j.savedAt || (j.header && j.header.savedAt) || (j.Header && j.Header.SavedAt))) || ''); } catch (e) { console.error('[wasm] save not JSON', k, e); }
    if (best == null || when > at) { best = k; at = when; }
  }
  return best;
}

export function createWasmTransport({ noAnswer = 'The game is not answering.', saves = null, store = browserStore() } = {}) {
  let booting = null;
  let api = null;
  if (saves == null) saves = readStoredSaves(store);
  function persist() {
    if (!api || !store) return;
    try { store.setItem(SAVES_KEY, api.ExportSaves()); } catch (e) { console.error('[wasm] saves not stored', e); }
  }

  async function boot() {
    const { dotnet } = await import(new URL('../../_framework/dotnet.js', import.meta.url).href);
    const runtime = await dotnet.create();
    const cfg = runtime.getConfig();
    const all = await runtime.getAssemblyExports(cfg.mainAssemblyName);
    const ex = all.GladeParks.Web.Wasm.Exports;
    const res = await fetch(new URL('../../data-pack.json', import.meta.url).href);
    if (!res.ok) throw new Error('data pack missing');
    const first = JSON.parse(ex.Init(await res.text(), JSON.stringify(saves || {})));
    api = ex;
    return first;
  }

  function parse(text) {
    try {
      const r = JSON.parse(text);
      if (!r || typeof r !== 'object' || r.contract !== 1 || typeof r.ok !== 'boolean') return failReply(noAnswer);
      return !r.ok && !r.error ? { ...r, error: noAnswer } : r;
    } catch (e) { console.error('[wasm] bad reply', e); return failReply(noAnswer); }
  }

  async function call(fn, arg) {
    try {
      if (!booting) booting = boot();
      await booting;
      const reply = parse(arg === undefined ? api[fn]() : api[fn](JSON.stringify(arg || {})));
      if (WRITES.has(fn)) persist();
      return reply;
    } catch (e) {
      console.error('[wasm]', e);
      booting = null;
      return failReply(noAnswer);
    }
  }

  // M2 (r58-i5): the client still calls some same-origin /api/* routes by raw fetch (creator, talk, encounter, session log,
  // city map commands). In wasm mode they are answered by the exports; nothing under /api/ ever leaves the page.
  const sessionLog = [];
  async function exportRaw(fn, arg) {
    if (!booting) booting = boot();
    await booting;
    return arg === undefined ? api[fn]() : api[fn](typeof arg === 'string' ? arg : JSON.stringify(arg));
  }
  const json = (status, body) => new Response(status === 204 ? null : (typeof body === 'string' && status >= 400 ? body : JSON.stringify(body)),
    { status, headers: { 'Content-Type': status >= 400 && typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8' } });
  async function routeReply(fn, arg) { const t = await exportRaw(fn, arg); if (WRITES.has(fn)) persist(); return json(200, JSON.parse(t)); }
  async function routeView(fn, arg) { const r = JSON.parse(await exportRaw(fn, arg)); return json(r.status, r.body); }
  async function answer(method, url, init) {
    const p = url.pathname;
    const body = async () => { try { return init && init.body ? JSON.parse(init.body) : {}; } catch (e) { console.error('[wasm shim] bad body', p, e); return {}; } };
    if (p === '/api/state') return routeReply('State');
    if (method === 'POST' && p === '/api/new') return routeReply('NewGame', await body());
    if (method === 'POST' && p === '/api/load') return routeReply('Load', await body());
    if (method === 'POST' && p === '/api/save') return routeReply('Save', await body());
    if (method === 'POST' && p === '/api/end-quarter') return routeReply('EndQuarter');
    if (method === 'POST' && p === '/api/command') return routeReply('Command', await body());
    if (method === 'POST' && p === '/api/act') return routeReply('Act', await body());
    if (p === '/api/creator/options') return routeView('CreatorOptions');
    if (p === '/api/creator/status') return routeView('CreatorStatus');
    if (method === 'POST' && p === '/api/creator/create') return routeReply('CreateDeveloper', await body());
    if (p === '/api/talk/scene') {
      const q = url.searchParams;
      return routeView('TalkScene', { scene: q.get('scene') || '', path: q.get('path') || '', offer: q.get('offer') || '', site: q.get('site') || '' });
    }
    if (p === '/api/encounter/pending') return routeView('EncounterPending');
    // r59-i5 (N404): Build and City reads (BuildRoutes and CityRoutes GETs) answered by the GetView export.
    if (method === 'GET' && (p.startsWith('/api/build/') || p.startsWith('/api/city/'))) return routeView('GetView', { path: p, query: Object.fromEntries(url.searchParams) });
    if (method === 'POST' && p === '/api/session-log') {
      const b = await body();
      if (Array.isArray(b.events)) { sessionLog.push(...b.events); if (sessionLog.length > 2000) sessionLog.splice(0, sessionLog.length - 2000); }
      return json(200, { ok: true, kept: sessionLog.length });
    }
    // F5 (r58-i5): an unhandled route gets a JSON error body; the line is the caller's noAnswer (passed in from Data words),
    // never a literal written here. The route is logged so the gap is visible.
    console.error('[wasm shim] no browser answer for', method, p);
    return json(501, { error: noAnswer });
  }
  function installShim(target = globalThis) {
    if (!target || typeof target.fetch !== 'function' || target.fetch.gpWasmShim) return;
    const real = target.fetch.bind(target);
    const shim = async (input, init) => {
      let url;
      try { url = new URL(typeof input === 'string' ? input : input.url, target.location ? target.location.href : 'http://local/'); }
      catch (e) { console.error('[wasm shim] url', e); return real(input, init); }
      const same = !target.location || url.origin === target.location.origin;
      if (!same || !url.pathname.startsWith('/api/')) return real(input, init);
      const method = ((init && init.method) || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
      try { return await answer(method, url, init); }
      catch (e) { console.error('[wasm shim]', method, url.pathname, e); return json(500, { error: noAnswer }); }
    };
    shim.gpWasmShim = true;
    target.fetch = shim;
  }
  if (typeof window !== 'undefined') installShim(window);

  return {
    name: 'wasm',
    sessionLog: () => sessionLog.slice(),
    state: () => call('State'),
    newGame: (o = {}) => call('NewGame', o),
    load: (o = {}) => call('Load', o),
    save: (o = {}) => call('Save', o),
    endQuarter: () => call('EndQuarter'),
    command: (o = {}) => call('Command', o),
    act: (o = {}) => call('Act', o),
    // r59-i5 (N404): a read-only GET, the same answer http.js get gives: parsed JSON, null on 204, a throw on 4xx/5xx with
    // the plain line. Answered from the exports; nothing leaves the page.
    get: async (path) => {
      const u = new URL(path, 'http://local/');
      const r = await answer('GET', u, undefined);
      if (r.status === 204) return null;
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    // Part 2: hands the player the newest save file (or the named one) as a download. Resolves true when one was given.
    downloadSave: async (name) => {
      try {
        if (!booting) booting = boot();
        await booting;
        const all = JSON.parse(api.ExportSaves());
        const pick = name && all[name] != null ? name : newest(all);
        if (!pick) return false;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([all[pick]], { type: 'application/json' }));
        a.download = pick.replace(/[^A-Za-z0-9._-]/g, '_') + (pick.endsWith('.json') ? '' : '.json');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return true;
      } catch (e) { console.error('[wasm] downloadSave', e); return false; }
    },
    exportSaves: async () => { try { if (!booting) booting = boot(); await booting; return JSON.parse(api.ExportSaves()); } catch (e) { console.error('[wasm] exportSaves', e); return {}; } },
    // Test surface (N192 part 4): the unparsed reply text of one export call, and Cine.Compile timing in WebAssembly.
    raw: async (fn, arg) => { if (!booting) booting = boot(); await booting; return arg === undefined ? api[fn]() : api[fn](JSON.stringify(arg || {})); },
    cineCompileMs: async (n = 20) => { if (!booting) booting = boot(); await booting; return JSON.parse(api.CineCompileMs(JSON.stringify({ runs: n }))); },
  };
}
