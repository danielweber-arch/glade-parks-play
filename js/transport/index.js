// createTransport picks a backend from the page URL: ?transport=http, ?transport=stub
// or ?transport=wasm. With no query, a <meta name="gp-transport"> tag decides (the
// publish script writes content="wasm" into Web/dist); else http (the local host). Every backend has the same seven async
// methods (state, newGame, load, save, endQuarter, command, act) and returns Replies (contract 1).
import { createHttpTransport } from './http.js';
import { createFixtureTransport } from './fixture.js';
import { createWasmTransport } from './wasm.js';

export const METHODS = ['state', 'newGame', 'load', 'save', 'endQuarter', 'command', 'act'];

export function pickTransportName(search, fallback = 'http') {
  const name = new URLSearchParams(search || '').get('transport') || fallback || 'http';
  return ['http', 'stub', 'wasm'].includes(name) ? name : 'http';
}

function metaDefault() {
  try { return document.querySelector('meta[name="gp-transport"]')?.getAttribute('content') || 'http'; } catch (e) { return 'http'; }
}

export function createTransport(opts = {}) {
  const name = opts.name || pickTransportName(typeof location !== 'undefined' ? location.search : '', metaDefault());
  if (name === 'stub') return createFixtureTransport(opts);
  if (name === 'wasm') return createWasmTransport(opts);
  return createHttpTransport(opts);
}
