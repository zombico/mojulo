// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as tool-descriptions.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

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
  installedGroups,
  installedPacks,
  isPackInstalled,
  isToolInstalled,
  installNotice,
  DEFAULT_ON_GROUPS,
  retiredInstallTokens,
  _setGroupPresence,
} from '@/lib/mcp/packs';
import { BOT_FACTORY_MOVED, REMOVED_BOT_TOOLS } from '@/lib/mcp/bot-factory-moved';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Packs-mode connect payload pin — the plan's headline number (~35KB target
// from ~250KB flat). Growth is a conscious re-pin, same contract as the flat
// PAYLOAD_CEILING in tool-descriptions.test.js.
// Re-pinned 2026-09-27 (35_000 -> 37_000; measured 36,794) for tool annotations: each spine tool
// and pack dispatcher now carries `title` + `annotations` (lib/mcp/tool-annotations.js).
// Checked 2026-09-27 for the chatbot carve-out's rehomed tools (pin unchanged; measured 36,793 ->
// 36,808): pack_runtime and pack_stash now name list_running, the app .env trio and recommend_kind,
// and the bot pack descriptions no longer do.
// Re-pinned 2026-09-28 (37_000 -> 34_000; measured 33,694) for the chatbot carve-out (3.0.0): the
// three bot pack dispatchers left, and pack_runtime and pack_connected_services stopped naming the
// chat_turn tools and chatbots. Shrink-only from here.
// Re-pinned 2026-10-06 (34_000 -> 33_400; measured 33,671 -> 33,263) for the pack menu: the shared pack
// input schema gained `manual` and paid for it by shortening the `tool` / `args` wording.
// Merged with the building ladder 2026-10-06 (33_400 -> 33_900; measured 33,263 -> 33,840): pack_building's
// entry, less the house redirects it let three pack descriptions drop.
const PACKS_PAYLOAD_CEILING = 33_900;

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

// The embedding runtime is the opt-in `recall` group: not a dependency, no pack
// of its own (semantic_search runs lexically without it), never default-on.
describe('install axis — the recall group', () => {
  afterEach(() => _setGroupPresence(null));

  it('is not part of a default install and owns no pack', () => {
    expect(DEFAULT_ON_GROUPS).toEqual(['creative']);
    expect(PACKS.filter((p) => p.installGroup === 'recall')).toEqual([]);
  });

  it('is detected physically or granted by MOJULO_PACKS, and never gates a tool', () => {
    _setGroupPresence(['creative']);
    expect(installedGroups({}).has('recall')).toBe(false);
    expect(installedGroups({ MOJULO_PACKS: 'creative,recall' }).has('recall')).toBe(true);
    _setGroupPresence(['creative', 'recall']);
    expect(installedGroups({}).has('recall')).toBe(true);
    expect(isToolInstalled('semantic_search', {})).toBe(true);
    _setGroupPresence(['creative']);
    expect(isToolInstalled('semantic_search', {})).toBe(true);
    expect(installNotice('semantic_search', {})).toBe(null);
  });
});

describe('install axis (MOJULO_PACKS) — PACK-grain: kernel + always-on packs + creative', () => {
  const world = () => PACKS.find((p) => p.id === 'pack_world');
  const catalysts = () => PACKS.find((p) => p.id === 'pack_catalysts');

  // THE DEFAULT: a fresh install is the whole workshop. `_setGroupPresence` forces the
  // physical probe so this asserts the shipped default rather than whatever the
  // developer's own ~/.mojulo happens to hold.
  it('default (unset) is creative + the always-on packs: every pack is installed', () => {
    _setGroupPresence(['creative']); // what a fresh `npx mojulo` detects
    try {
      expect([...installedGroups({})]).toEqual(['creative']);
      expect(isToolInstalled('compose_world', {})).toBe(true);
      expect(isToolInstalled('list_catalysts', {})).toBe(true);
      expect(isToolInstalled('start_app', {})).toBe(true);
      for (const s of SPINE) expect(isToolInstalled(s, {})).toBe(true);
      expect(installedPacks({}).length).toBe(PACKS.length);
    } finally {
      _setGroupPresence(null);
    }
  });

  it('unrecognized token fails open to physical detection (a typo never empties the workshop)', () => {
    _setGroupPresence(['creative']);
    try {
      expect([...installedGroups({ MOJULO_PACKS: 'nonsense' })]).toEqual(['creative']);
      expect([...installedGroups({ MOJULO_PACKS: '' })]).toEqual(['creative']);
    } finally {
      _setGroupPresence(null);
    }
  });

  // Under 1.5 this was wing-grain, so gating the studio wing off also gated the whole
  // office wing. Now only packs that DECLARE a group are gatable; the orchestration
  // plumbing declares none and is unconditional, exactly like the kernel.
  it('packs declaring NO install group are always present — plumbing is not gatable', () => {
    const ungrouped = PACKS.filter((p) => !p.installGroup);
    expect(ungrouped.map((p) => p.id).sort()).toEqual([
      'pack_catalysts', 'pack_connected_services', 'pack_plan',
      'pack_research', 'pack_runtime', 'pack_stash',
    ]);
    for (const env of [{ MOJULO_PACKS: 'creative' }, { MOJULO_PACKS: 'recall' }]) {
      for (const pack of ungrouped) expect(isPackInstalled(pack, env)).toBe(true);
    }
    // and their tools run under any override
    expect(isToolInstalled('list_catalysts', { MOJULO_PACKS: 'recall' })).toBe(true);
    expect(isToolInstalled('list_plans', { MOJULO_PACKS: 'recall' })).toBe(true);
  });

  it('MOJULO_PACKS=creative is the whole workshop', () => {
    const env = { MOJULO_PACKS: 'creative' };
    expect([...installedGroups(env)]).toEqual(['creative']);
    expect(installedPacks(env).length).toBe(PACKS.length);
    for (const s of SPINE) expect(isToolInstalled(s, env)).toBe(true);
  });

  it('MOJULO_PACKS=recall gates the creative pack off, plumbing still on', () => {
    const env = { MOJULO_PACKS: 'recall' };
    expect([...installedGroups(env)]).toEqual(['recall']);
    expect(isToolInstalled('compose_world', env)).toBe(false);
    expect(isToolInstalled('list_catalysts', env)).toBe(true);
    expect(isToolInstalled('start_app', env)).toBe(true);
  });

  // The chatbot group left with the chatbot factory in 3.0.0. A 2.x config that still names it
  // (or its `ops` alias) must keep working: the token is skipped, never an error, never a group.
  it("the retired 'chatbot' and 'ops' tokens are ignored, and reported as retired", () => {
    _setGroupPresence(['creative']);
    try {
      for (const csv of ['chatbot', 'ops', 'ops,chatbot']) {
        expect([...installedGroups({ MOJULO_PACKS: csv })]).toEqual(['creative']); // falls through to disk
        expect(installedPacks({ MOJULO_PACKS: csv }).length).toBe(PACKS.length);
      }
      expect([...installedGroups({ MOJULO_PACKS: 'chatbot,creative' })]).toEqual(['creative']);
      expect([...installedGroups({ MOJULO_PACKS: 'chatbot,recall' })]).toEqual(['recall']);
      expect(retiredInstallTokens({ MOJULO_PACKS: 'creative, Chatbot,ops' })).toEqual(
        expect.arrayContaining(['MOJULO_PACKS=chatbot', 'MOJULO_PACKS=ops']),
      );
      expect(retiredInstallTokens({ MOJULO_PACKS: 'creative' }).filter((t) => t.startsWith('MOJULO_PACKS'))).toEqual([]);
    } finally {
      _setGroupPresence(null);
    }
  });

  it('MOJULO_PACKS=recall,creative is the full install again', () => {
    const env = { MOJULO_PACKS: 'recall,creative' };
    expect([...installedGroups(env)].sort()).toEqual(['creative', 'recall']);
    expect(installedPacks(env).length).toBe(PACKS.length);
  });

  it('installNotice: null when installed, advisory (not a refusal) when gated', () => {
    expect(installNotice('compose_world', {})).toBeNull();
    expect(installNotice('compose_world', { MOJULO_PACKS: 'recall' })).toMatch(/creative capability pack/);
    // creative ships with every install, so the fix for a gated creative is the override, not an install
    expect(installNotice('compose_world', { MOJULO_PACKS: 'recall' })).toMatch(/include 'creative' in MOJULO_PACKS/);
    expect(installNotice('compose_world', { MOJULO_PACKS: 'recall' })).not.toMatch(/mojulo install creative/);
    expect(installNotice('forward_context', { MOJULO_PACKS: 'recall' })).toBeNull(); // spine → kernel
    expect(installNotice('list_catalysts', { MOJULO_PACKS: 'recall' })).toBeNull(); // ungrouped → kernel-adjacent
  });

  it('isPackInstalled follows the pack install GROUP, not its wing', () => {
    expect(isPackInstalled(world(), { MOJULO_PACKS: 'recall' })).toBe(false);
    expect(isPackInstalled(catalysts(), { MOJULO_PACKS: 'recall' })).toBe(true);
    expect(isPackInstalled(world(), { MOJULO_PACKS: 'creative' })).toBe(true);
  });

  it('every pack declares the creative group or none, and no chatbot pack remains', () => {
    for (const pack of PACKS) {
      if (pack.installGroup) expect(pack.installGroup).toBe('creative');
    }
    const ids = PACKS.map((p) => p.id);
    for (const id of ['pack_bot_build', 'pack_bot_operate', 'pack_fleet']) expect(ids).not.toContain(id);
  });
});

describe('install axis — physical detection is the source of truth (unset MOJULO_PACKS)', () => {
  afterEach(() => _setGroupPresence(null)); // clear the forced probe → back to real disk

  it('creative is always installed: the real probe finds it with no marker package on disk', () => {
    _setGroupPresence(null); // the real probe; `three` used to be the marker and is no longer a dependency
    expect(installedGroups({}).has('creative')).toBe(true);
    expect(isToolInstalled('compose_world', {})).toBe(true);
  });

  it('unset env derives groups from physical presence, not a hardcoded default', () => {
    _setGroupPresence(['recall']); // a probe that found recall only (seam; creative itself is always present)
    expect([...installedGroups({})]).toEqual(['recall']);
    expect(isPackInstalled(PACKS.find((p) => p.installGroup === 'creative'), {})).toBe(false);
    expect(isToolInstalled('compose_world', {})).toBe(false);
    // ungrouped packs survive a probe that found nothing
    _setGroupPresence([]);
    expect(isToolInstalled('list_catalysts', {})).toBe(true);
  });

  it('explicit MOJULO_PACKS overrides physical detection (a deliberate operator wins)', () => {
    _setGroupPresence(['recall']); // creative absent on disk...
    expect([...installedGroups({ MOJULO_PACKS: 'recall,creative' })].sort()).toEqual(['creative', 'recall']);
  });

  it('typo falls through to physical detection, never an empty workshop', () => {
    _setGroupPresence(['recall']);
    expect([...installedGroups({ MOJULO_PACKS: 'zzz' })]).toEqual(['recall']);
  });

  it('a chatbot marker left by a 2.x install is ignored by the probe and reported as retired', () => {
    const home = mkdtempSync(join(tmpdir(), 'mojulo-retired-marker-'));
    mkdirSync(join(home, 'packs'));
    writeFileSync(join(home, 'packs', 'chatbot'), 'mojulo chatbot pack — presence marker.\n');
    const prev = process.env.MOJULO_HOME;
    process.env.MOJULO_HOME = home;
    _setGroupPresence(null); // force the real probe
    try {
      const groups = installedGroups({});
      expect(groups.has('chatbot')).toBe(false);
      expect(groups.has('creative')).toBe(true);
      expect(installedPacks({}).length).toBe(PACKS.length);
      expect(retiredInstallTokens({})).toEqual([join(home, 'packs', 'chatbot')]);
    } finally {
      if (prev === undefined) delete process.env.MOJULO_HOME; else process.env.MOJULO_HOME = prev;
      _setGroupPresence(null);
      rmSync(home, { recursive: true, force: true });
    }
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

  it('packs-mode list drops an uninstalled group\'s pack dispatchers, keeps spine + the rest', () => {
    withInstall('recall', () => withPacksMode(() => {
      const names = listTools({ clientInfo: { name: 'codex' } }).map((t) => t.name);
      expect(names).toContain('pack_catalysts');   // ungrouped → always present
      expect(names).toContain('forward_context');  // spine → kernel
      for (const studio of ['pack_world', 'pack_audio', 'pack_object', 'pack_game', 'pack_view']) {
        expect(names).not.toContain(studio);
      }
    }));
  });

  it('flat-mode list drops an uninstalled group\'s member tools', () => {
    withInstall('recall', () => withFlatMode(() => {
      const names = listTools({}).map((t) => t.name);
      expect(names).toContain('list_catalysts');    // ungrouped → always present
      expect(names).not.toContain('compose_world'); // creative member gated
    }));
  });

  it('tools/call on a gated tool returns the install advisory (METHOD_NOT_FOUND), not execution', async () => {
    const res = await withInstall('recall', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 991, method: 'tools/call', params: { name: 'compose_world', arguments: {} } }, {}));
    expect(res.error).toBeTruthy();
    expect(res.error.message).toMatch(/creative capability pack/);
  });

  it('tools/call on an installed tool is NOT gated (no install advisory)', async () => {
    const res = await withInstall('recall', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 992, method: 'tools/call', params: { name: 'list_cooks', arguments: {} } }, {}));
    // may succeed or return a tool-level isError, but must never be the install notice
    const msg = res.error?.message || res.result?.content?.[0]?.text || '';
    expect(msg).not.toMatch(/capability pack/);
  });
});

describe('the chatbot factory left in 3.0.0 — its names answer with the moved notice', () => {
  it('no removed name is registered, listed in either mode, or a pack member', () => {
    const members = new Set(PACKS.flatMap((p) => dispatchTargets(p)));
    const flat = withFlatMode(() => listTools({}).map((t) => t.name));
    const packs = withPacksMode(() => listTools({ clientInfo: { name: 'codex' } }).map((t) => t.name));
    for (const name of REMOVED_BOT_TOOLS) {
      expect(hasRegisteredTool(name), name).toBe(false);
      expect(members.has(name), name).toBe(false);
      expect(flat, name).not.toContain(name);
      expect(packs, name).not.toContain(name);
    }
  });

  it('tools/call on a removed name is an in-band isError result carrying the notice', async () => {
    for (const name of ['save_modular_bot', 'emit_chat_signal', 'pack_bot_build']) {
      const res = await server.dispatchMcpRequest(
        { jsonrpc: '2.0', id: 881, method: 'tools/call', params: { name, arguments: {} } }, {});
      expect(res.error, name).toBeUndefined();
      expect(res.result.isError, name).toBe(true);
      expect(res.result.content[0].text, name).toContain(BOT_FACTORY_MOVED);
      expect(res.result.content[0].text, name).toContain(`'${name}'`);
    }
  });

  it('a removed name dispatched through a pack, or run by the plan executor, gets the notice too', async () => {
    const res = await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 882, method: 'tools/call',
        params: { name: 'pack_runtime', arguments: { tool: 'request_chat_decision', args: {} } } }, {});
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain(BOT_FACTORY_MOVED);
    await expect(server.invokeRegisteredTool('list_deployments', {}, {})).rejects.toThrow(BOT_FACTORY_MOVED);
  });

  // A 2.x skill that managed app env or ranked cook kinds through the old bot packs: the tool is
  // still here under a new home, so the answer is where to dispatch it, not "the factory moved".
  it('a removed pack dispatcher naming a tool 3.0 kept is re-routed to its home pack', async () => {
    const cases = [
      ['pack_bot_operate', 'list_running', 'pack_runtime'],
      ['pack_bot_operate', 'set_env', 'pack_runtime'],
      ['pack_bot_build', 'recommend_kind', homePackForTool('recommend_kind').id],
    ];
    for (const [pack, tool, home] of cases) {
      const res = await server.dispatchMcpRequest(
        { jsonrpc: '2.0', id: 884, method: 'tools/call', params: { name: pack, arguments: { tool, args: {} } } }, {});
      const text = res.result.content[0].text;
      expect(res.result.isError, `${pack} ${tool}`).toBe(true);
      expect(text, `${pack} ${tool}`).toContain(`it is homed in ${home}. Dispatch it there: ${home}({ tool: '${tool}'`);
      expect(text, `${pack} ${tool}`).not.toContain(BOT_FACTORY_MOVED);
    }
    await expect(server.invokeRegisteredTool('pack_bot_operate', { tool: 'list_env' }, {})).rejects.toThrow(/homed in pack_runtime/);
    // A removed member, or a bare call, still gets the moved notice.
    for (const args of [{ tool: 'get_deployment', args: {} }, {}]) {
      const res = await server.dispatchMcpRequest(
        { jsonrpc: '2.0', id: 885, method: 'tools/call', params: { name: 'pack_bot_operate', arguments: args } }, {});
      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain(BOT_FACTORY_MOVED);
    }
  });

  it('any other unknown name stays an unknown tool', async () => {
    const res = await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 883, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } }, {});
    expect(res.error.message).toMatch(/Unknown tool/);
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

  it('creative gated off: pack_world({tool:compose_world}) is refused (group-level, anti-spin), not executed', async () => {
    const res = await withInstall('recall', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 771, method: 'tools/call',
        params: { name: 'pack_world', arguments: { tool: 'compose_world', args: {} } } }, {}));
    const msg = res.error?.message || res.result?.content?.[0]?.text || '';
    expect(msg).toMatch(/creative capability pack is not installed/i);
    expect(msg).toMatch(/Do not retry/i);            // anti-spin: terminal, group-level
    expect(msg).not.toMatch(/worldUrl|"ref":\s*"sk_/); // proves it never minted a world
  });

  it('full install: the same dispatch is NOT gated', async () => {
    const res = await withInstall('recall,creative', () => server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 772, method: 'tools/call',
        params: { name: 'pack_world', arguments: { tool: 'compose_world', args: {} } } }, {}));
    const msg = res.error?.message || res.result?.content?.[0]?.text || '';
    expect(msg).not.toMatch(/capability pack is not installed/i);
  });
});

describe('pack dispatcher', () => {
  // A render tool may first download Chrome for Testing or ffmpeg. Its own budget applies to the
  // member call, and the pack that dispatches it must not cut it off at the 120 s default first.
  it('render tools carry the long budget, and so does every pack that dispatches them', async () => {
    const { RENDER_TOOL_TIMEOUT_MS, DEFAULT_TOOL_TIMEOUT_MS } = await import('@/lib/mcp/telemetry');
    const { homePackForTool } = await import('@/lib/mcp/packs');
    for (const name of ['forge_motion', 'stitch_motion', 'export_game', 'create_game']) {
      expect(server.getRegisteredTool(name).timeoutMs, name).toBe(RENDER_TOOL_TIMEOUT_MS);
      const pack = homePackForTool(name);
      expect(server.getRegisteredTool(pack.id).timeoutMs, pack.id).toBeGreaterThanOrEqual(RENDER_TOOL_TIMEOUT_MS);
    }
    // A pack with no long member keeps the default.
    expect(server.getRegisteredTool('pack_audio').timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS).toBe(DEFAULT_TOOL_TIMEOUT_MS);
  });

  it('bare call unveils a menu: small members inline their manual, larger ones name its size', async () => {
    const { INLINE_MANUAL_MAX } = await import('@/lib/mcp/tools/packs-tools');
    const res = await callTool('pack_stash', {});
    const text = res.result.content[0].text;
    expect(res.result.isError).toBeFalsy();
    expect(text).toContain('pack_stash');
    expect(text).toContain("{ tool: '<name>', args:");
    expect(text).toContain("pack_stash({ manual: '<name>' })");
    // cook (~16 KB) is on the menu by name and size, not by its manual.
    const cook = server.getRegisteredTool('cook');
    expect(text).toContain('### cook');
    expect(text).toMatch(/Manual \d+\.\d KB: `pack_stash\(\{ manual: 'cook' \}\)`/);
    expect(text).not.toContain(cook.description);
    // A light member's manual is inline, schema and all.
    const light = PACKS.find((p) => p.id === 'pack_stash').members
      .map((n) => server.getRegisteredTool(n))
      .find((t) => t && (t.description || '').length + JSON.stringify(t.inputSchema || {}).length < INLINE_MANUAL_MAX - 100);
    expect(light, 'pack_stash has a light member').toBeTruthy();
    expect(text).toContain(light.description);
    expect(text).toContain(`\`inputSchema\`: ${JSON.stringify(light.inputSchema)}`);
  });

  it('every pack opens to a menu that names every member and is smaller than the full manual', async () => {
    const { dispatchTargets } = await import('@/lib/mcp/packs');
    for (const pack of PACKS) {
      const text = (await callTool(pack.id, {})).result.content[0].text;
      let full = 0;
      for (const name of dispatchTargets(pack)) {
        expect(text, `${pack.id} menu misses ${name}`).toContain(`### ${name}`);
        const t = server.getRegisteredTool(name);
        full += (t.description || '').length + JSON.stringify(t.inputSchema || {}).length;
      }
      expect(text.length, pack.id).toBeLessThan(full + 4000);
    }
  });

  it('manual returns exactly the member manual the old unveil inlined', async () => {
    const res = await callTool('pack_stash', { manual: 'cook' });
    expect(res.result.isError).toBeFalsy();
    const text = res.result.content[0].text;
    const cook = server.getRegisteredTool('cook');
    expect(text).toContain(`### cook\n${cook.description}\n\`inputSchema\`: ${JSON.stringify(cook.inputSchema)}`);
    expect(text).toContain("pack_stash({ tool: '<name>', args:");
  });

  it('manual reads a list; a shared member keeps its home note', async () => {
    const res = await callTool('pack_illustration', { manual: ['update_sketch', 'create_cover'] });
    const text = res.result.content[0].text;
    expect(res.result.isError).toBeFalsy();
    expect(text).toContain('### update_sketch _(homed in pack_diagram; dispatchable here)_');
    expect(text).toContain('### create_cover');
  });

  it('manual answers wrong-pack, spine and unknown names as dispatch does', async () => {
    const wrong = await callTool('pack_audio', { manual: 'create_sketch' });
    expect(wrong.result.isError).toBe(true);
    expect(wrong.result.content[0].text).toContain("pack_diagram({ manual: 'create_sketch' })");
    const spine = await callTool('pack_audio', { manual: 'forward_context' });
    expect(spine.result.isError).toBe(true);
    expect(spine.result.content[0].text).toContain('spine');
    const unknown = await callTool('pack_audio', { manual: 'no_such_tool' });
    expect(unknown.result.isError).toBe(true);
    expect(unknown.result.content[0].text).toContain('for its menu');
    // A mixed list reads what it can and says why the rest can't be read.
    const mixed = await callTool('pack_audio', { manual: ['create_beats', 'no_such_tool'] });
    expect(mixed.result.isError).toBeFalsy();
    expect(mixed.result.content[0].text).toContain('### create_beats');
    expect(mixed.result.content[0].text).toContain("'no_such_tool' is not a member of pack_audio");
    const empty = await callTool('pack_audio', { manual: [] });
    expect(empty.result.isError).toBe(true);
  });

  it("a member's error through a pack points at its manual; a structured refusal is untouched", async () => {
    const failed = await callTool('pack_illustration', { tool: 'update_sketch', args: { ref: 'no-such-ref-pointer' } });
    expect(failed.result.isError).toBe(true);
    expect(failed.result.content[0].text).toMatch(/\nManual: pack_illustration\(\{ manual: 'update_sketch' \}\)$/);
    // The same call made directly carries no pointer.
    const direct = await callTool('update_sketch', { ref: 'no-such-ref-pointer' });
    expect(direct.result.content[0].text).not.toContain('Manual:');
  });

  it('studio unveil serves a one-line member index, not the full FORM body', async () => {
    const { FORM_TOOLSETS } = await import('@/lib/mcp/tools/context');
    const world = (await callTool('pack_world', {})).result.content[0].text;
    expect(world).toContain(FORM_TOOLSETS.world.makes);
    // Every member is indexed on one line, and that line is the row's first
    // sentence — the full row (with its recognizer tail) is not repeated.
    for (const m of FORM_TOOLSETS.world.body.matchAll(/^- `([a-z_]+)` — /gm)) {
      const line = world.split('\n').find((l) => l.startsWith(`- \`${m[1]}\` — `));
      expect(line, `${m[1]} has no index line`).toBeTruthy();
      expect(line.length).toBeLessThanOrEqual(260);
    }
    expect(world).not.toContain(FORM_TOOLSETS.world.body);
    // The authoritative description is not repeated: once if the member is light
    // enough to inline, else not at all (its manual is read on demand).
    const desc = server.getRegisteredTool('compose_world').description;
    expect(world.split(desc).length - 1).toBeLessThanOrEqual(1);
  });

  it('studio unveil names every member; multi-form packs serve both forms', async () => {
    const world = (await callTool('pack_world', {})).result.content[0].text;
    expect(world).toContain('compose_world'); // index names its tools
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

  it('a taken ref refuses with REF_EXISTS and the revision tool as next_action', async () => {
    const args = {
      kind: 'beats-composition', title: 'menu', ref: 'pack-ref-exists-beats',
      params: { bpm: 120, parts: [{ name: 'lead', patch: 'fmBell', events: [['0:0:0', 'C4', '0:0:2', 0.8]] }] },
    };
    const first = await callTool('pack_audio', { tool: 'create_beats', args });
    expect(first.result.isError, first.result.content?.[0]?.text).toBeFalsy();
    const second = await callTool('pack_audio', { tool: 'create_beats', args });
    expect(second.result.isError).toBe(true);
    const body = JSON.parse(second.result.content[0].text);
    expect(body.code).toBe('REF_EXISTS');
    expect(body.ref).toBe('pack-ref-exists-beats');
    expect(body.next_action.tool).toBe('update_beats');
    expect(body.read_first.tool).toBe('get_beats');
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
    expect(res.result.content[0].text).toContain('for its menu');
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
