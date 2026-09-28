// The Claude plugin profile (plugin-profile.js). When the Claude plugin starts mojulo
// (MOJULO_DISTRIBUTION=claude-plugin), the image-render, mesh and voice handoffs, the sprite sheets
// and style presets, the painted sketch kinds, the skin op and the keyed prompt door leave every
// surface and refuse in-band on every path; every other distribution is untouched.
//
// Most of this boots the real stdio server (scripts/mcp-stdio.mjs) in a throwaway home, as the
// plugin does, and reads what an MCP client would see. The in-process half pins the pieces a
// session cannot reach: the text edits (a surface that drifts from its edit is recorded and fails
// here) and the byte-identity of the other distributions.
//
// Payload, measured when this landed (the tools/list array as JSON, a fresh home, 2026-09-28): flat
// (Claude Code) 268,550 bytes for 148 tools, 240,837 bytes for 127 under the profile; packs (any other
// client) 33,694 bytes for 28 entries, 31,391 bytes for 26. The flat and packs pins live in
// tool-descriptions.test.js and packs.test.js; they measure the default surface and did not move.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLUGIN_PROFILE_HIDDEN_TOOLS,
  PLUGIN_PROFILE_HIDDEN_PACKS,
  PLUGIN_PROFILE_HIDDEN_FORMS,
  PLUGIN_PROFILE_HIDDEN_ROWS,
  PROMPT_DOOR_NOTICE,
  hiddenInPluginProfile,
  hiddenRowInPluginProfile,
  pluginProfileActive,
  pluginProfileNotice,
  profileEdit,
  profileEditMisses,
  mentionsHiddenTool,
  dropHiddenToolLines,
  toolFace,
} from './plugin-profile.js';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STDIO = path.join(CONTROL_DIR, 'scripts', 'mcp-stdio.mjs');
const HIDDEN = [...PLUGIN_PROFILE_HIDDEN_TOOLS, ...PLUGIN_PROFILE_HIDDEN_PACKS];
const HIDDEN_RE = new RegExp(`\\b(?:${HIDDEN.join('|')})\\b`, 'g');
const notice = (name) => `'${name}' is not part of the Claude plugin build of mojulo.`;

// A clean environment in a throwaway home: no MOJULO_* from the runner (its MOJULO_PACKS floor
// included), so the server sees what a fresh plugin install sees.
function freshEnv(extra = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'mojulo-plugin-profile-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
    !k.startsWith('MOJULO_') && !['SQLITE_PATH', 'ARTIFACTS_DIR', 'STORAGE_ROOT'].includes(k)));
  Object.assign(env, {
    HOME: home, USERPROFILE: home, MOJULO_HOME: path.join(home, '.mojulo'), MOJULO_DISABLE_SCENE_WARM: '1',
  }, extra);
  return { env, home };
}

// One stdio session: initialize as `client`, tools/list, then `calls` in order. Resolves with the
// initialize result, the tools, and each call's result (or JSON-RPC error) in order.
function session({ distribution, client, calls = [], packs }) {
  const { env, home } = freshEnv({
    ...(distribution ? { MOJULO_DISTRIBUTION: distribution } : {}),
    ...(packs ? { MOJULO_TOOL_PACKS: packs } : {}),
  });
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [STDIO], { cwd: home, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map();
    let out = '';
    let stderr = '';
    let id = 0;
    const timer = setTimeout(() => child.kill('SIGKILL'), HOOK_BUDGET - 10_000);
    child.stderr.on('data', (d) => { stderr += d; });
    child.stdout.on('data', (d) => {
      out += d;
      let i;
      while ((i = out.indexOf('\n')) >= 0) {
        const line = out.slice(0, i);
        out = out.slice(i + 1);
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        pending.get(msg.id)?.(msg);
        pending.delete(msg.id);
      }
    });
    const request = (method, params) => new Promise((done) => {
      const n = ++id;
      pending.set(n, done);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: n, method, params })}\n`);
    });
    const run = async () => {
      const init = await request('initialize', {
        protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: client, version: '0' },
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
      const list = await request('tools/list', {});
      const results = [];
      for (const [name, args] of calls) {
        const r = await request('tools/call', { name, arguments: args ?? {} });
        results.push(r.error ? { rpcError: r.error } : { isError: Boolean(r.result?.isError), text: (r.result?.content ?? []).map((c) => c.text).join('\n') });
      }
      return { init: init.result, tools: list.result?.tools ?? [], results, stderr };
    };
    child.on('error', reject);
    run().then((r) => {
      clearTimeout(timer);
      child.kill('SIGTERM');
      rmSync(home, { recursive: true, force: true });
      resolve(r);
    }, reject);
  });
}

// The CLI, as a shell caller runs it under the plugin's environment.
function cli(args) {
  const { env, home } = freshEnv({ MOJULO_DISTRIBUTION: 'claude-plugin' });
  const r = spawnSync(process.execPath, [STDIO, ...args], { cwd: home, env, encoding: 'utf8', timeout: 60_000 });
  rmSync(home, { recursive: true, force: true });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const hiddenIn = (text) => [...new Set(String(text).match(HIDDEN_RE) ?? [])];

// Booting the server (or importing the whole tool registry) takes a few seconds alone and far more
// under a parallel full-suite run, so the hooks and sessions here get generous budgets.
const HOOK_BUDGET = 120_000;

describe('the profile module', () => {
  it('is on only for the claude-plugin distribution', () => {
    expect(pluginProfileActive({ MOJULO_DISTRIBUTION: 'claude-plugin' })).toBe(true);
    expect(pluginProfileActive({ MOJULO_DISTRIBUTION: 'npm' })).toBe(false);
    expect(pluginProfileActive({ MOJULO_DISTRIBUTION: 'source' })).toBe(false);
    expect(hiddenInPluginProfile('create_voice', { MOJULO_DISTRIBUTION: 'npm' })).toBe(false);
    expect(hiddenInPluginProfile('create_voice', { MOJULO_DISTRIBUTION: 'claude-plugin' })).toBe(true);
    expect(hiddenInPluginProfile('create_beats', { MOJULO_DISTRIBUTION: 'claude-plugin' })).toBe(false);
    expect(hiddenRowInPluginProfile('catalyst', 'render-image-outcome-locally', { MOJULO_DISTRIBUTION: 'claude-plugin' })).toBe(true);
    expect(hiddenRowInPluginProfile('catalyst', 'render-image-outcome-locally', { MOJULO_DISTRIBUTION: 'npm' })).toBe(false);
  });

  it('refuses neutrally: no other install, version or command is named', () => {
    for (const text of [pluginProfileNotice("'x'"), PROMPT_DOOR_NOTICE]) {
      expect(text).toMatch(/not part of the Claude plugin build of mojulo/);
      expect(text).not.toMatch(/npx|mojulo@|2\.x|install/i);
    }
    expect(PROMPT_DOOR_NOTICE).toMatch(/via:'packet'/);
  });

  it('drops only the bullets that name a hidden tool, and records an edit that finds nothing', () => {
    expect(dropHiddenToolLines('- `create_voice` — x\n- `create_beats` — y')).toBe('- `create_beats` — y');
    expect(mentionsHiddenTool('call bind_mesh_render next')).toBe(true);
    expect(mentionsHiddenTool('call export_model next')).toBe(false);
    expect(profileEdit('abc', [['b', 'B']], 'unit')).toBe('aBc');
    profileEdit('abc', [['zzz-no-such-text', '']], 'unit-miss');
    expect(profileEditMisses().some((m) => m.startsWith('unit-miss:'))).toBe(true);
  });

  it('shows a tool its own face outside the profile', () => {
    const tool = { description: 'own', inputSchema: { a: 1 }, pluginProfile: { description: 'profile' } };
    expect(toolFace(tool, { MOJULO_DISTRIBUTION: 'npm' })).toEqual({ description: 'own', inputSchema: { a: 1 } });
    expect(toolFace(tool, { MOJULO_DISTRIBUTION: 'claude-plugin' })).toEqual({ description: 'profile', inputSchema: { a: 1 } });
  });
});

describe('stdio under MOJULO_DISTRIBUTION=claude-plugin', () => {
  let flat;
  let packs;
  beforeAll(async () => {
    [flat, packs] = await Promise.all([
      session({
        distribution: 'claude-plugin',
        client: 'claude-code',
        calls: [
          // direct calls to hidden tools
          ...['bind_image_render', 'request_image_render', 'get_image_render_packet', 'bind_character_sheet', 'request_mesh_render',
            'accept_mesh_render', 'bind_mesh_render', 'create_voice', 'get_voice_vocab', 'create_sprite_sheet', 'get_style_vocab',
            'get_skin_packet', 'create_polygonized_sketch'].map((name) => [name, {}]),
          // through the pack dispatchers, including a hidden pack itself
          ['pack_image_render', {}],
          ['pack_voice', { tool: 'create_voice', args: {} }],
          ['pack_world', { tool: 'bind_mesh_render', args: { ref: 'sk_x', glb_path: '/x.glb' } }],
          ['pack_game', { tool: 'create_sprite_sheet', args: {} }],
          ['pack_diagram', { tool: 'create_voice', args: {} }],
          // closed doors on kept tools
          ['mint_solid', { kind: 'manji-tree', via: 'prompt', spec: { prompt: 'a small dragon', provider: 'anthropic' } }],
          ['edit_solid', { op: 'skin', ref: 'sk_x', spec: { phase: 'packet' } }],
          ['create_sketch', { title: 'x', manifest: { kind: 'image-outcome', title: 'x' } }],
          ['forge_motion', { subject: { scene_ref: 'sk_x' } }],
          ['get_creative_toolset', { form: 'voice' }],
          ['get_catalyst', { id: 'render-image-outcome-locally' }],
          ['get_sketch_vocab', { id: 'sequential-art' }],
          ['get_solid_vocab', { id: 'skin' }],
        ],
      }),
      session({ distribution: 'claude-plugin', client: 'probe-client' }),
    ]);
  }, HOOK_BUDGET);

  it('lists none of the hidden tools, flat or packs, and names none in any description or schema', () => {
    expect(flat.tools.length, flat.stderr).toBeGreaterThan(50);
    const flatNames = flat.tools.map((t) => t.name);
    for (const name of HIDDEN) expect(flatNames).not.toContain(name);
    expect(hiddenIn(JSON.stringify(flat.tools))).toEqual([]);

    const packNames = packs.tools.map((t) => t.name);
    expect(packNames).toContain('pack_world');
    for (const name of HIDDEN) expect(packNames).not.toContain(name);
    expect(hiddenIn(JSON.stringify(packs.tools))).toEqual([]);
  });

  it('shows the kept tools without their closed doors', () => {
    const tool = (name) => flat.tools.find((t) => t.name === name);
    expect(JSON.stringify(tool('mint_solid'))).not.toMatch(/'prompt'|ir\/parts\/prompt/);
    expect(tool('edit_solid').inputSchema.properties.op.enum).toEqual(['emote']);
    expect(tool('export_model').inputSchema.properties).not.toHaveProperty('cdn');
    expect(tool('export_game').inputSchema.properties).not.toHaveProperty('cdn');
    expect(tool('forge_motion').inputSchema.properties.subject.properties).not.toHaveProperty('scene_ref');
    expect(tool('get_creative_toolset').inputSchema.properties.form.enum).not.toEqual(
      expect.arrayContaining(PLUGIN_PROFILE_HIDDEN_FORMS),
    );
    expect(JSON.stringify(tool('create_sketch'))).not.toMatch(/image-outcome|sequential-art|keyframe-animation/);
    expect(JSON.stringify(tool('create_cover'))).not.toMatch(/painted layers|render_brief/);
  });

  it('keeps the voice registers out of the initialize preamble', () => {
    for (const s of [flat, packs]) {
      expect(s.init.instructions).toMatch(/motion, audio, publications/);
      expect(hiddenIn(s.init.instructions)).toEqual([]);
    }
  });

  it('refuses every hidden tool in-band, directly and through any pack', () => {
    const direct = ['bind_image_render', 'request_image_render', 'get_image_render_packet', 'bind_character_sheet', 'request_mesh_render',
      'accept_mesh_render', 'bind_mesh_render', 'create_voice', 'get_voice_vocab', 'create_sprite_sheet', 'get_style_vocab',
      'get_skin_packet', 'create_polygonized_sketch'];
    direct.forEach((name, i) => expect(flat.results[i]).toEqual({ isError: true, text: notice(name) }));
    const via = flat.results.slice(direct.length, direct.length + 5);
    expect(via).toEqual([
      { isError: true, text: notice('pack_image_render') },
      { isError: true, text: notice('pack_voice') },
      { isError: true, text: notice('bind_mesh_render') },
      { isError: true, text: notice('create_sprite_sheet') },
      { isError: true, text: notice('create_voice') },
    ]);
  });

  it('refuses the closed doors of kept tools, and says which door to use for the prompt', () => {
    const doors = flat.results.slice(18);
    expect(doors).toHaveLength(8);
    for (const r of doors) {
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(/not part of the Claude plugin build of mojulo/);
      expect(r.text).not.toMatch(/npx|mojulo@/);
    }
    expect(doors[0].text).toBe(PROMPT_DOOR_NOTICE);
    expect(doors[1].text).toMatch(/edit_solid op:'skin'/);
    expect(doors[2].text).toMatch(/create_sketch kind 'image-outcome'/);
    expect(doors[3].text).toMatch(/forge_motion subject\.scene_ref/);
    expect(doors[4].text).toMatch(/'voice' form/);
    expect(doors[5].text).toMatch(/'render-image-outcome-locally' catalyst/);
  });
});

describe('orientation surfaces under the profile', () => {
  let s;
  const surfaces = [
    ['forward_context', {}],
    ['forward_context', { mode: 'office' }],
    ['get_tool_index', { full: true }],
    ['get_tool_index', { budget_bytes: 20000 }],
    ['get_substrate', {}],
    ['get_ui_map', {}],
    ['get_register_kit', {}],
    ['get_register_kit', { register: 'mojulo' }],
    ['get_register_kit', { register: 'plain' }],
    ['get_creative_toolset', {}],
    ...['diagram', 'illustration', 'reference', 'object', 'world', 'view', 'motion', 'motion-comic', 'audio', 'game']
      .map((form) => ['get_creative_toolset', { form }]),
    ['get_worked_example', {}],
    ...['media', 'game', 'app', 'connected-service'].map((paradigm) => ['get_worked_example', { paradigm }]),
    ['list_catalysts', {}],
    ['recommend_catalysts', {}],
    ['list_adapters', {}],
    ...['claude-code', 'generic', 'codex', 'grok-build', 'hermes'].map((id) => ['get_adapter', { id }]),
    ['get_catalyst', { id: 'print-object' }],
    ['get_sketch_vocab', {}],
    ...['panel-depiction-recipes', 'wardrobe-construction', 'motion-comic'].map((id) => ['get_sketch_vocab', { id }]),
    ['get_solid_vocab', {}],
    ['translate_modeler_lingo', { lingo: 'toleranced cad part' }],
    ['get_tool_ledger', { orientation: true }],
    ...['pack_object', 'pack_world', 'pack_game', 'pack_view', 'pack_motion', 'pack_audio', 'pack_illustration', 'pack_reference',
      'pack_diagram', 'pack_runtime', 'pack_connected_services', 'pack_plan', 'pack_research', 'pack_stash', 'pack_catalysts']
      .map((id) => [id, {}]),
    ...['paint an image of a dragon', 'a narrator voice', 'a sprite sheet walk cycle', 'a comic page', 'a workbench object',
      'assemble parts', 'an invented creature', 'pose a human figure', 'rebuild a machine from a concept image', 'skin a figure']
      .flatMap((query) => [['semantic_search', { query, limit: 12 }], ['semantic_search', { query, kinds: ['routing'] }]]),
  ];
  beforeAll(async () => {
    s = await session({ distribution: 'claude-plugin', client: 'claude-code', calls: surfaces });
  }, HOOK_BUDGET);

  it('never name a hidden tool or pack', () => {
    surfaces.forEach(([name, args], i) => {
      const r = s.results[i];
      expect(r.isError, `${name} ${JSON.stringify(args)}: ${r.text?.slice(0, 200)}`).toBe(false);
      expect(hiddenIn(r.text), `${name} ${JSON.stringify(args)}`).toEqual([]);
    });
  });

  it('never return a card, catalyst or routing row the profile leaves out', () => {
    surfaces.forEach(([name], i) => {
      if (name !== 'semantic_search') return;
      for (const row of JSON.parse(s.results[i].text).results) {
        expect(hiddenRowInPluginProfile(row.source_kind, row.source_ref, { MOJULO_DISTRIBUTION: 'claude-plugin' }), `${row.source_kind}:${row.source_ref}`).toBe(false);
      }
    });
    const catalysts = JSON.parse(s.results[surfaces.findIndex(([n]) => n === 'list_catalysts')].text).catalysts.map((c) => c.id);
    for (const id of PLUGIN_PROFILE_HIDDEN_ROWS.catalyst) expect(catalysts).not.toContain(id);
    const cards = JSON.parse(s.results[surfaces.findIndex(([n, a]) => n === 'get_sketch_vocab' && !a.id)].text).cards.map((c) => c.id);
    for (const id of PLUGIN_PROFILE_HIDDEN_ROWS.sketch_vocab) expect(cards).not.toContain(id);
  });

  it('describe the profile honestly: no download, no CDN page, no keyed door, no hidden form', () => {
    const text = (name, args = {}) => s.results[surfaces.findIndex(([n, a]) => n === name && JSON.stringify(a) === JSON.stringify(args))].text;
    const substrate = text('get_substrate');
    expect(substrate).not.toMatch(/storage\.googleapis\.com|ffmpeg-static|cdn: true|via:'prompt'|then the start downloads it/);
    expect(substrate).toMatch(/No LLM flow leaves the machine/);
    // Fact 11 says this in every build since the notes merge; the profile no longer edits it.
    expect(substrate).toMatch(/point the operator at those docs/);
    expect(substrate).not.toMatch(/fetch the repo docs/i);
    expect(substrate).toMatch(/Earlier 2\.x versions that include it are unmaintained and have known security issues\./);
    expect(substrate).not.toMatch(/2\.x line keeps it/);
    for (const form of PLUGIN_PROFILE_HIDDEN_FORMS) {
      expect(text('forward_context')).not.toMatch(new RegExp(`· ${form} ·`));
      expect(text('get_creative_toolset')).not.toMatch(new RegExp(`\`${form}\``));
    }
    expect(text('forward_context')).not.toMatch(/VOICE|image-outcome|sequential-art/);
    expect(text('get_ui_map')).not.toMatch(/\/maker\/voice|image-render queue/);
  });
});

describe('the CLI under the profile', () => {
  it('lists no hidden tool or pack, and refuses them on every verb', { timeout: 6 * 60_000 }, () => {
    const tools = cli(['tools']);
    expect(tools.code, tools.stderr).toBe(0);
    expect(hiddenIn(tools.stdout)).toEqual([]);
    const packList = cli(['packs']);
    expect(packList.code).toBe(0);
    expect(hiddenIn(packList.stdout)).toEqual([]);
    const orient = cli(['orient']);
    expect(orient.stdout).toMatch(/motion, audio, publications/);

    const call = cli(['call', 'bind_image_render', '--json', '{}']);
    expect(call.code).toBe(1);
    expect(call.stdout.trim()).toBe(notice('bind_image_render'));
    const help = cli(['help', 'create_voice']);
    expect(help.code).toBe(2);
    expect(help.stderr).toMatch(/'create_voice' is not part of the Claude plugin build of mojulo/);
    const viaPack = cli(['pack_world', 'bind_mesh_render', '--json', '{"ref":"sk_x","glb_path":"/x.glb"}']);
    expect(viaPack.code).toBe(1);
    expect(viaPack.stdout.trim()).toBe(notice('bind_mesh_render'));
    const listing = cli(['tools', 'pack_world']);
    expect(hiddenIn(listing.stdout)).toEqual([]);
  });
});

describe('in-process', () => {
  const saved = process.env.MOJULO_DISTRIBUTION;
  let server;
  let packsMod;
  beforeAll(async () => {
    server = await import('./server.js');
    packsMod = await import('./packs.js');
    await server.ensureToolsRegistered();
  }, HOOK_BUDGET);
  afterAll(() => {
    if (saved === undefined) delete process.env.MOJULO_DISTRIBUTION;
    else process.env.MOJULO_DISTRIBUTION = saved;
  });

  it('leaves every other distribution byte-identical: each listed entry is the tool as registered', () => {
    for (const dist of ['npm', 'source']) {
      process.env.MOJULO_DISTRIBUTION = dist;
      const flatList = server.listTools({ clientInfo: { name: 'claude-code' } });
      for (const entry of flatList) {
        const tool = server.getRegisteredTool(entry.name);
        expect(entry.description).toBe(tool.description || '');
        expect(entry.inputSchema).toEqual(tool.inputSchema || { type: 'object', properties: {} });
      }
      for (const name of PLUGIN_PROFILE_HIDDEN_TOOLS.filter((n) => server.isToolListed(n))) {
        expect(flatList.map((e) => e.name)).toContain(name);
      }
      process.env.MOJULO_TOOL_PACKS = 'on';
      const packList = server.listTools({ clientInfo: { name: 'probe-client' } });
      delete process.env.MOJULO_TOOL_PACKS;
      for (const pack of packsMod.installedPacks()) {
        expect(packList.find((e) => e.name === pack.id)?.description).toBe(pack.description);
      }
      expect(server.serverInstructions()).toBe(server.SERVER_INSTRUCTIONS);
    }
  });

  it('compiles no plan step and runs no plan-executor call for a hidden tool', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const { _internals } = await import('./tools/plan-mode.js');
    const validate = _internals.validateManifest;
    const r = validate([{ tool: 'create_voice', args: {} }, { tool: 'create_beats', args: {} }]);
    expect(r.unknownTools).toEqual(['create_voice']);
    await expect(server.invokeRegisteredTool('bind_mesh_render', {}, {})).rejects.toThrow(notice('bind_mesh_render'));
    process.env.MOJULO_DISTRIBUTION = 'npm';
    expect(validate([{ tool: 'create_voice', args: {} }]).unknownTools).toEqual([]);
  });

  it('has an edit for every profile text it serves (no edit found its source text missing)', async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const context = await import('./tools/context.js');
    const { getAdapter, listAdapters } = await import('./adapters/loader.js');
    const { getSketchVocabHandler } = await import('./tools/sketch-vocab.js');
    const { CREATIVE_FORMS } = await import('./creative-forms.js');
    for (const form of CREATIVE_FORMS) context.formToolset(form, true);
    for (const mode of ['studio', 'office']) context.buildForwardContextBody({ mode, profile: true });
    for (const register of ['plain', 'mixed', 'mojulo']) context.buildRegisterKitBody({ register });
    await context.substrateHandler();
    await context.uiMapHandler();
    await context.toolIndexHandler({ full: true });
    for (const adapter of listAdapters()) getAdapter(adapter.id);
    await getSketchVocabHandler({});
    for (const id of ['panel-depiction-recipes', 'wardrobe-construction']) await getSketchVocabHandler({ id });
    const { handoffFor } = await import('./hosts/handoff.js');
    handoffFor({ host: 'claude-code', surface: 'box', artifact: { kind: 'page', name: 'world.html', path: '/p/world.html', bytes: 40 * 1024 * 1024, inlineScripts: true } });
    expect(profileEditMisses().filter((m) => !m.startsWith('unit-miss:'))).toEqual([]);
  });

  it('points an artifact-door page at the file, not at a CDN build it will not write', async () => {
    const { handoffFor } = await import('./hosts/handoff.js');
    const page = { kind: 'page', name: 'world.html', path: '/p/world.html', bytes: 40 * 1024 * 1024, inlineScripts: true };
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: page });
    expect(n.caveats.join(' ')).not.toMatch(/cdn: true/);
    expect(n.caveats.join(' ')).toMatch(/format: 'bundle'/);
    process.env.MOJULO_DISTRIBUTION = 'npm';
    expect(handoffFor({ host: 'claude-code', surface: 'box', artifact: page }).caveats.join(' ')).toMatch(/cdn: true/);
  });
});
