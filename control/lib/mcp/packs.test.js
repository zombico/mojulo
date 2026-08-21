// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as tool-descriptions.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Pack partition sweep (tool-packs.plan.md P1-R/P2-D).
//
// The partition is the accounting layer of packs mode: every LISTED tool must
// be in exactly one pack's `members`, or in SPINE, or in FOLDED. A new tool
// that forgets its pack fails here — assign it a home in lib/mcp/packs.js
// (exactly one; use `shared` only for the tiny cross-form set).
// ---------------------------------------------------------------------------

import {
  PACKS,
  SPINE,
  FOLDED,
  PACK_DESCRIPTION_CEILING,
  PACK_INPUT_SCHEMA,
  packsModeEnabled,
  homePackForTool,
  dispatchTargets,
  installedWings,
  installedPacks,
  isPackInstalled,
  isToolInstalled,
  installNotice,
} from '@/lib/mcp/packs';

// Packs-mode connect payload pin — the plan's headline number (~35KB target
// from ~250KB flat). Growth is a conscious re-pin, same contract as the flat
// PAYLOAD_CEILING in tool-descriptions.test.js.
const PACKS_PAYLOAD_CEILING = 35_000;

let server;
let listTools;
let hasRegisteredTool;

beforeAll(async () => {
  server = await import('@/lib/mcp/server');
  await server.ensureToolsRegistered();
  listTools = server.listTools;
  hasRegisteredTool = server.hasRegisteredTool;
});

function withPacksMode(fn) {
  process.env.MOJULO_TOOL_PACKS = 'on';
  try {
    return fn();
  } finally {
    delete process.env.MOJULO_TOOL_PACKS;
  }
}

// Packs are the default now (packsModeEnabled: on unless MOJULO_TOOL_PACKS=off),
// so assertions about the FLAT connect surface must force it explicitly.
function withFlatMode(fn) {
  const prev = process.env.MOJULO_TOOL_PACKS;
  process.env.MOJULO_TOOL_PACKS = 'off';
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prev;
  }
}

async function callTool(name, args) {
  return server.dispatchMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
    { mcpSessionId: 'packs-test', userId: 'local' }
  );
}

describe('pack registry shape', () => {
  it('pack ids are unique and pack_-prefixed', () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^pack_[a-z_]+$/);
  });

  it('every pack description fits the ceiling', () => {
    for (const pack of PACKS) {
      expect(
        pack.description.length,
        `${pack.id} description ${pack.description.length} > ${PACK_DESCRIPTION_CEILING}`
      ).toBeLessThanOrEqual(PACK_DESCRIPTION_CEILING);
    }
  });

  it('studio packs name a form; office packs carry a body', () => {
    for (const pack of PACKS) {
      if (pack.wing === 'studio') {
        expect(pack.form, `${pack.id} missing form`).toBeTruthy();
      } else {
        expect(pack.wing).toBe('office');
        expect(pack.body, `${pack.id} missing body`).toBeTruthy();
      }
    }
  });

  it('shared entries are homed in a DIFFERENT pack', () => {
    for (const pack of PACKS) {
      for (const name of pack.shared || []) {
        const home = homePackForTool(name);
        expect(home, `${pack.id} shares '${name}' which has no home`).toBeTruthy();
        expect(home.id, `${pack.id} shares '${name}' but also homes it`).not.toBe(pack.id);
      }
    }
  });
});

describe('partition sweep against the live registry', () => {
  it('every listed tool is in exactly one pack, the spine, or FOLDED', () => {
    const listed = withFlatMode(() => listTools()).map((t) => t.name);
    const spine = new Set(SPINE);
    const folded = new Set(FOLDED);

    // exactly-one-home check across pack membership
    const homes = new Map();
    for (const pack of PACKS) {
      for (const name of pack.members) {
        if (!homes.has(name)) homes.set(name, []);
        homes.get(name).push(pack.id);
      }
    }
    const multiHomed = [...homes.entries()].filter(([, ids]) => ids.length > 1);
    expect(multiHomed, `multi-homed: ${JSON.stringify(multiHomed)}`).toEqual([]);

    const unassigned = listed.filter(
      (name) => !homes.has(name) && !spine.has(name) && !folded.has(name)
    );
    expect(
      unassigned,
      `listed tools with no pack home (assign in lib/mcp/packs.js): ${unassigned.join(', ')}`
    ).toEqual([]);

    // no tool double-counted between spine/folded and a pack
    const overlaps = [...homes.keys()].filter((name) => spine.has(name) || folded.has(name));
    expect(overlaps, `in a pack AND spine/folded: ${overlaps.join(', ')}`).toEqual([]);
  });

  it('every pack member, shared entry, spine and folded tool exists in the registry', () => {
    const missing = [];
    for (const pack of PACKS) {
      for (const name of dispatchTargets(pack)) {
        if (!hasRegisteredTool(name)) missing.push(`${pack.id}:${name}`);
      }
    }
    for (const name of [...SPINE, ...FOLDED]) {
      if (!hasRegisteredTool(name)) missing.push(`spine/folded:${name}`);
    }
    expect(missing, `named in packs.js but not registered: ${missing.join(', ')}`).toEqual([]);
  });

  it('spine and pack members reference LISTED tools (aliases stay out of packs)', () => {
    const listed = new Set(withFlatMode(() => listTools()).map((t) => t.name));
    const unlisted = [];
    for (const pack of PACKS) {
      for (const name of pack.members) {
        if (!listed.has(name)) unlisted.push(`${pack.id}:${name}`);
      }
    }
    for (const name of SPINE) {
      if (!listed.has(name)) unlisted.push(`spine:${name}`);
    }
    expect(unlisted, `pack/spine names that are not listed tools: ${unlisted.join(', ')}`).toEqual([]);
  });
});

describe('listTools packs mode (MOJULO_TOOL_PACKS=on)', () => {
  it('returns exactly spine + one tool per pack, packs carrying the dispatch schema', () => {
    const tools = withPacksMode(() => listTools());
    expect(tools.length).toBe(SPINE.length + PACKS.length);
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const name of SPINE) expect(byName.has(name), `spine ${name} missing`).toBe(true);
    for (const pack of PACKS) {
      const entry = byName.get(pack.id);
      expect(entry, `${pack.id} missing from packs-mode list`).toBeTruthy();
      expect(entry.inputSchema).toEqual(PACK_INPUT_SCHEMA);
      expect(entry.description).toBe(pack.description);
    }
    // folded + members are gone from the connect surface
    for (const name of FOLDED) expect(byName.has(name)).toBe(false);
    expect(byName.has('create_beats')).toBe(false);
  });

  it(`packs-mode connect payload stays under the ${PACKS_PAYLOAD_CEILING}-byte pin`, () => {
    const bytes = Buffer.byteLength(JSON.stringify(withPacksMode(() => listTools())), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[packs] packs-mode tools/list payload: ${bytes} bytes`);
    expect(bytes).toBeLessThanOrEqual(PACKS_PAYLOAD_CEILING);
  });

  it('flat mode lists no pack tools (byte-identity with the pre-packs surface)', () => {
    const names = withFlatMode(() => listTools()).map((t) => t.name);
    expect(names.filter((n) => n.startsWith('pack_'))).toEqual([]);
    for (const name of FOLDED) expect(names).toContain(name);
  });

  it('packs are the DEFAULT — no env var yields the spine + packs surface', () => {
    const prev = process.env.MOJULO_TOOL_PACKS;
    delete process.env.MOJULO_TOOL_PACKS;
    try {
      const tools = listTools();
      expect(tools.length).toBe(SPINE.length + PACKS.length);
      expect(tools.some((t) => t.name.startsWith('pack_'))).toBe(true);
      // a folded member is off the default connect surface
      expect(tools.some((t) => t.name === 'create_beats')).toBe(false);
    } finally {
      if (prev !== undefined) process.env.MOJULO_TOOL_PACKS = prev;
    }
  });

  it('initialize teaches the dispatch grammar only in packs mode', async () => {
    const init = () =>
      server.dispatchMcpRequest(
        { jsonrpc: '2.0', id: 9, method: 'initialize', params: {} },
        { mcpSessionId: 'packs-test' }
      );
    const flat = await withFlatMode(() => init());
    expect(flat.result.instructions).not.toContain('Tool packs are ON');
    const packs = await withPacksMode(() => init());
    expect(packs.result.instructions).toContain('Tool packs are ON');
    expect(packs.result.instructions).toContain(server.SERVER_INSTRUCTIONS);
  });
});

describe('host-aware default (packs opinionated; flat for deferring hosts)', () => {
  it('packsModeEnabled tri-state: explicit off/on override the host', () => {
    // off wins over any client
    expect(packsModeEnabled({ MOJULO_TOOL_PACKS: 'off' }, { clientDefers: false })).toBe(false);
    expect(packsModeEnabled({ MOJULO_TOOL_PACKS: 'off' }, { clientDefers: true })).toBe(false);
    // on wins over any client
    expect(packsModeEnabled({ MOJULO_TOOL_PACKS: 'on' }, { clientDefers: true })).toBe(true);
    expect(packsModeEnabled({ MOJULO_TOOL_PACKS: 'on' }, { clientDefers: false })).toBe(true);
  });

  it('packsModeEnabled default: packs unless the host defers', () => {
    expect(packsModeEnabled({}, { clientDefers: false })).toBe(true);
    expect(packsModeEnabled({}, { clientDefers: true })).toBe(false);
    expect(packsModeEnabled({})).toBe(true); // no hint → opinionated packs
  });

  it('clientDefersSchemas: claude family defers; codex/unknown do not', () => {
    expect(server.clientDefersSchemas({ name: 'claude-code' })).toBe(true);
    expect(server.clientDefersSchemas({ name: 'claude-ai' })).toBe(true);
    expect(server.clientDefersSchemas({ name: 'Claude Code 2.1.143' })).toBe(true);
    expect(server.clientDefersSchemas({ name: 'codex' })).toBe(false);
    expect(server.clientDefersSchemas({ name: 'some-random-host' })).toBe(false);
    expect(server.clientDefersSchemas(null)).toBe(false);
    expect(server.clientDefersSchemas({})).toBe(false);
  });

  async function connectAndList(clientName, sessionId) {
    await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: clientName } } },
      { mcpSessionId: sessionId },
    );
    const reply = await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { mcpSessionId: sessionId },
    );
    return reply.result.tools.map((t) => t.name);
  }

  it('Claude Code connect → flat surface over the wire (no pack tools)', async () => {
    const names = await connectAndList('claude-code', 'host-cc');
    expect(names.some((n) => n.startsWith('pack_'))).toBe(false);
    expect(names).toContain('create_beats'); // folded member is listed flat
  });

  it('a non-deferring host (codex) → packs surface over the wire', async () => {
    const names = await connectAndList('codex', 'host-codex');
    expect(names.some((n) => n.startsWith('pack_'))).toBe(true);
    expect(names).not.toContain('create_beats');
  });

  it('initialize addendum matches the resolved mode per host', async () => {
    const cc = await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 3, method: 'initialize', params: { clientInfo: { name: 'claude-code' } } },
      { mcpSessionId: 'host-cc-init' },
    );
    expect(cc.result.instructions).not.toContain('Tool packs are ON');
    const cx = await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 4, method: 'initialize', params: { clientInfo: { name: 'codex' } } },
      { mcpSessionId: 'host-codex-init' },
    );
    expect(cx.result.instructions).toContain('Tool packs are ON');
  });
});

describe('install axis (MOJULO_PACKS) — kernel + ops/creative', () => {
  it('default (unset) is a full install: both wings, all packs, nothing gated', () => {
    expect([...installedWings({})].sort()).toEqual(['office', 'studio']);
    expect(installedPacks({}).length).toBe(PACKS.length);
    // every listed tool + every spine tool is installed at full install
    for (const pack of PACKS) for (const m of pack.members) expect(isToolInstalled(m, {})).toBe(true);
    for (const s of SPINE) expect(isToolInstalled(s, {})).toBe(true);
  });

  it('unrecognized token fails open to full install (a typo never empties the workshop)', () => {
    expect([...installedWings({ MOJULO_PACKS: 'nonsense' })].sort()).toEqual(['office', 'studio']);
    expect([...installedWings({ MOJULO_PACKS: '' })].sort()).toEqual(['office', 'studio']);
  });

  it('MOJULO_PACKS=ops installs only the office wing (creative packs gated)', () => {
    const env = { MOJULO_PACKS: 'ops' };
    expect([...installedWings(env)]).toEqual(['office']);
    const packs = installedPacks(env);
    expect(packs.every((p) => p.wing === 'office')).toBe(true);
    expect(packs.some((p) => p.wing === 'studio')).toBe(false);
    // office member on, studio member off
    expect(isToolInstalled('start_new_bot', env)).toBe(true);
    expect(isToolInstalled('compose_world', env)).toBe(false);
    // spine stays kernel regardless of install
    for (const s of SPINE) expect(isToolInstalled(s, env)).toBe(true);
  });

  it('MOJULO_PACKS=creative installs only the studio wing', () => {
    const env = { MOJULO_PACKS: 'creative' };
    expect([...installedWings(env)]).toEqual(['studio']);
    expect(isToolInstalled('compose_world', env)).toBe(true);
    expect(isToolInstalled('start_new_bot', env)).toBe(false);
  });

  it('MOJULO_PACKS=ops,creative is the full install again', () => {
    expect([...installedWings({ MOJULO_PACKS: 'ops,creative' })].sort()).toEqual(['office', 'studio']);
    expect(installedPacks({ MOJULO_PACKS: 'ops,creative' }).length).toBe(PACKS.length);
  });

  it('installNotice: null when installed, advisory (not a refusal) when gated', () => {
    expect(installNotice('compose_world', {})).toBeNull();
    expect(installNotice('compose_world', { MOJULO_PACKS: 'ops' })).toMatch(/creative capability pack/);
    expect(installNotice('start_new_bot', { MOJULO_PACKS: 'ops' })).toBeNull();
    expect(installNotice('forward_context', { MOJULO_PACKS: 'ops' })).toBeNull(); // spine → kernel
  });

  it('isPackInstalled matches its pack wing', () => {
    const world = PACKS.find((p) => p.id === 'pack_world');
    const botOps = PACKS.find((p) => p.id === 'pack_bot_operate');
    expect(isPackInstalled(world, { MOJULO_PACKS: 'ops' })).toBe(false);
    expect(isPackInstalled(botOps, { MOJULO_PACKS: 'ops' })).toBe(true);
  });
});

describe('install gate — server wiring (listTools + tools/call)', () => {
  function withInstall(packsCsv, fn) {
    const prev = process.env.MOJULO_PACKS;
    process.env.MOJULO_PACKS = packsCsv;
    try { return fn(); } finally {
      if (prev === undefined) delete process.env.MOJULO_PACKS; else process.env.MOJULO_PACKS = prev;
    }
  }

  it('packs-mode list drops an uninstalled wing\'s pack dispatchers, keeps spine + installed wing', () => {
    withInstall('ops', () => withPacksMode(() => {
      const names = listTools({ clientInfo: { name: 'codex' } }).map((t) => t.name);
      expect(names).toContain('pack_bot_build');   // office → installed
      expect(names).toContain('forward_context');  // spine → kernel
      for (const studio of ['pack_world', 'pack_audio', 'pack_object', 'pack_game', 'pack_view']) {
        expect(names).not.toContain(studio);
      }
    }));
  });

  it('flat-mode list drops an uninstalled wing\'s member tools', () => {
    withInstall('ops', () => withFlatMode(() => {
      const names = listTools({}).map((t) => t.name);
      expect(names).toContain('start_new_bot');    // office member
      expect(names).not.toContain('compose_world'); // studio member gated
    }));
  });

  it('tools/call on a gated tool returns the install advisory (METHOD_NOT_FOUND), not execution', async () => {
    const res = await withInstall('ops', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 991, method: 'tools/call', params: { name: 'compose_world', arguments: {} } }, {}));
    expect(res.error).toBeTruthy();
    expect(res.error.message).toMatch(/creative capability pack/);
  });

  it('tools/call on an installed tool is NOT gated (no install advisory)', async () => {
    const res = await withInstall('ops', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 992, method: 'tools/call', params: { name: 'list_deployments', arguments: {} } }, {}));
    // may succeed or return a tool-level isError, but must never be the install notice
    const msg = res.error?.message || res.result?.content?.[0]?.text || '';
    expect(msg).not.toMatch(/capability pack/);
  });
});

describe('iron wall — dispatcher cannot RUN an uninstalled pack tool', () => {
  // async: hold MOJULO_PACKS for the WHOLE async dispatch (a real process fixes it
  // at start; the deep dispatch path reads it well past the first await).
  async function withInstall(csv, fn) {
    const prev = process.env.MOJULO_PACKS;
    process.env.MOJULO_PACKS = csv;
    try { return await fn(); } finally {
      if (prev === undefined) delete process.env.MOJULO_PACKS; else process.env.MOJULO_PACKS = prev;
    }
  }

  it('ops install: pack_world({tool:compose_world}) is refused (wing-level, anti-spin), not executed', async () => {
    const res = await withInstall('ops', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 771, method: 'tools/call',
        params: { name: 'pack_world', arguments: { tool: 'compose_world', args: {} } } }, {}));
    const msg = res.error?.message || res.result?.content?.[0]?.text || '';
    expect(msg).toMatch(/creative capability pack is not installed/i);
    expect(msg).toMatch(/Do not retry/i);            // anti-spin: terminal, wing-level
    expect(msg).not.toMatch(/worldUrl|"ref":\s*"sk_/); // proves it never minted a world
  });

  it('full install: the same dispatch is NOT gated', async () => {
    const res = await withInstall('ops,creative', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 772, method: 'tools/call',
        params: { name: 'pack_world', arguments: { tool: 'compose_world', args: {} } } }, {}));
    const msg = res.error?.message || res.result?.content?.[0]?.text || '';
    expect(msg).not.toMatch(/capability pack is not installed/i);
  });
});

describe('pack dispatcher', () => {
  it('bare call unveils: body + member manual with real schemas + grammar line', async () => {
    const res = await callTool('pack_audio', {});
    const text = res.result.content[0].text;
    expect(res.result.isError).toBeFalsy();
    expect(text).toContain('pack_audio');
    for (const name of ['create_beats', 'get_beats_vocab', 'export_beats']) {
      expect(text).toContain(`### ${name}`);
    }
    expect(text).toContain('inputSchema');
    expect(text).toContain("{ tool: '<name>', args:");
  });

  it('studio unveil serves the FORM body; multi-form packs serve both', async () => {
    const world = (await callTool('pack_world', {})).result.content[0].text;
    expect(world).toContain('compose_world'); // form body names its tools
    const motion = (await callTool('pack_motion', {})).result.content[0].text;
    // pack_motion carries motion + motion-comic; shared tools flagged with home
    expect(motion).toContain('homed in pack_diagram');
  });

  it('dispatches a member and returns its real result', async () => {
    const direct = await callTool('list_world_themes', {});
    const packed = await callTool('pack_world', { tool: 'list_world_themes', args: {} });
    expect(packed.result.isError).toBeFalsy();
    expect(packed.result.content[0].text).toBe(direct.result.content[0].text);
  });

  it('rejects cross-pack dispatch naming the home pack', async () => {
    const res = await callTool('pack_audio', { tool: 'create_sketch', args: {} });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('pack_diagram');
  });

  it('rejects spine tools with a call-directly pointer', async () => {
    const res = await callTool('pack_audio', { tool: 'forward_context' });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('spine');
  });

  it('rejects unknown tools with a manual pointer', async () => {
    const res = await callTool('pack_audio', { tool: 'no_such_tool' });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('member manual');
  });

  it('accepts shared members from the sharing pack', async () => {
    // update_sketch is homed in pack_diagram, shared into pack_illustration —
    // dispatch there must NOT be rejected as cross-pack (a missing-ref
    // execution error is fine; a routing rejection is not).
    const res = await callTool('pack_illustration', {
      tool: 'update_sketch',
      args: { ref: 'no-such-ref-xyz' },
    });
    const text = res.result.content[0].text;
    expect(text).not.toContain('is not in pack_illustration');
  });
});

describe('runToolSerialized (member-level queue re-entry)', () => {
  it('serializes non-concurrent members FIFO and lets concurrent members bypass', async () => {
    const order = [];
    const writer = { name: 'w', concurrent: false };
    const poller = { name: 'p', concurrent: true };
    const slow = server.runToolSerialized(writer, async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('slow-writer');
    });
    const fast = server.runToolSerialized(writer, async () => {
      order.push('second-writer');
    });
    const bypass = server.runToolSerialized(poller, async () => {
      order.push('poller');
    });
    await Promise.all([slow, fast, bypass]);
    // poller ran without waiting on the writer chain; writers stayed FIFO
    expect(order.indexOf('poller')).toBeLessThan(order.indexOf('slow-writer'));
    expect(order.indexOf('slow-writer')).toBeLessThan(order.indexOf('second-writer'));
  });
});
