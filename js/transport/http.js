// HTTP backend: talks to Web/Host on the same origin. A network failure or a
// bad answer becomes a Reply with ok false and one plain line, never a throw.
export function failReply(line) {
  return { contract: 1, ok: false, error: line, messages: [], hasGame: false, stub: false, hud: null, screen: null, saves: [] };
}

export function createHttpTransport({ base = '', noAnswer = 'The game is not answering.' } = {}) {
  async function call(method, path, body) {
    try {
      const init = { method, headers: { Accept: 'application/json' } };
      if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      const res = await fetch(base + path, init);
      const reply = await res.json().catch(() => null);
      // Only a contract 1 Reply passes through; any other JSON (a problem
      // details body on a 500, an array) becomes one plain line.
      if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return failReply(noAnswer);
      if (typeof reply.ok !== 'boolean' || reply.contract !== 1) return failReply(noAnswer);
      if (!reply.ok && !reply.error) return { ...reply, error: noAnswer };
      return reply;
    } catch (e) {
      return failReply(noAnswer);
    }
  }
  return {
    name: 'http',
    state: () => call('GET', '/api/state'),
    newGame: (o = {}) => call('POST', '/api/new', o),
    load: (o = {}) => call('POST', '/api/load', o),
    save: (o = {}) => call('POST', '/api/save', o),
    endQuarter: () => call('POST', '/api/end-quarter', {}),
    command: (o = {}) => call('POST', '/api/command', o),
    act: (o = {}) => call('POST', '/api/act', o),
    // r59-i5 (N404): a read-only GET (build, city, encounter views): parsed JSON, null on 204, a throw on 4xx/5xx carrying
    // the host's plain line, so callers keep their own handling. Same shape as wasm.js get.
    get: async (path) => {
      const res = await fetch(base + path, { headers: { Accept: 'application/json' } });
      if (res.status === 204) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    // Test only (N229): works only when the host runs with --test-reset; else the call answers a failed Reply.
    failNextCutscene: (kind = 'fail') => call('POST', '/api/test/fail-next-cutscene', { kind }),
  };
}
