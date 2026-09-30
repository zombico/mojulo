/**
 * The handoff note (remote-worker exports P4): one expected `next` per host
 * and surface, the two-row note when the surface is unknown, the generic
 * fallback, and host resolution from clientInfo / MOJULO_HOST.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { handoffFor, handoffForContext, resolveHandoffHost, resolveHandoffSurface, fitsBudget } from './handoff.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';

const PAGE = { kind: 'page', name: 'world.html', path: '/box/outcomes/sk_x/world.html', dir: '/box/outcomes/sk_x', bytes: 9_100_000, download_url: '/outcomes/sk_x/world.html' };
// what export_model stamps on its mesh: the bundle zips the same file, and recipe.json is written beside it
const GLB = { kind: 'file', name: 'model.glb', path: '/box/outcomes/sk_x/model.glb', dir: '/box/outcomes/sk_x', bytes: 3_600_000, download_url: '/outcomes/sk_x/model.glb', bundled: true, recipe: 'recipe.json' };
const ZIP = { kind: 'file', name: 'sk_x.zip', path: '/box/outcomes/sk_x/sk_x.zip', dir: '/box/outcomes/sk_x', bytes: 6_000_000, download_url: '/outcomes/sk_x/sk_x.zip' };

describe('handoffFor', () => {
  it('claude-code + page + box: publish with the Artifact tool, under the 16 MiB limit', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: PAGE });
    expect(n.surface).toBe('box');
    expect(n.door).toBe('artifact');
    expect(n.next).toMatch(/publish world\.html \(8\.7 MiB\) with your Artifact tool/);
    expect(n.next).toMatch(/≤ 16\.0 MiB/);
    expect(n.caveats).toEqual([expect.stringMatching(/reclaimed when the session ends/)]);
    expect(n.verified).toBe('field');
  });

  // The CSP advisory once rode inside the over-budget branch, so a page that FITS the 16 MiB
  // door — the overwhelmingly common case — was waved through and then rendered black behind the
  // host's `script-src`. Size and CSP are independent facts about the door and each gets its own
  // caveat. The inline page is the default export since 3.0, so this is the common case again.
  it('claude-code + the default inline-script page that FITS: the CSP caveat fires on size alone being fine', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: { ...PAGE, bytes: 2 * 1024 * 1024, inlineScripts: true } });
    expect(n.next).toMatch(/publish world\.html/);
    expect(n.caveats[0]).toMatch(/refuses at ANY size/);
    expect(n.caveats[0]).toMatch(/cdn\.jsdelivr\.net\/npm\//);
    expect(n.caveats[0]).toMatch(/re-export with `cdn: true` and publish world\.cdn\.html/);
    // it fits, so NO byte caveat rides along
    expect(n.caveats.join(' ')).not.toMatch(/over this host's page limit/);
  });

  it('claude-code + the cdn: true page that fits: no CSP caveat at all', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: { ...PAGE, name: 'world.cdn.html', bytes: 2 * 1024 * 1024 } });
    expect(n.caveats.join(' ')).not.toMatch(/CSP|ANY size/);
  });

  it('claude-code + page over budget: still a note, never a refusal', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: { ...PAGE, bytes: 17 * 1024 * 1024 } });
    expect(n.next).toMatch(/publish world\.html/);
    expect(n.caveats[0]).toMatch(/over this host's page limit by 1\.0 MiB.*lighten the recipe/);
  });

  it('claude-code + glb + box: glb is off the download allowlist, the bundle is the move', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: GLB });
    expect(n.door).toBe('artifact-download');
    expect(n.next).toMatch(/^a page you publish can offer model\.glb \(3\.4 MiB\) through its downloads capability .*or push the outcome folder \/box\/outcomes\/sk_x to the branch$/);
    expect(n.caveats[0]).toMatch(/\.glb is not on this host's download allowlist.*cannot ride as a supporting file either.*format: 'bundle'/);
    const z = handoffFor({ host: 'claude-code', surface: 'box', artifact: ZIP });
    expect(z.caveats.some((c) => /allowlist/.test(c))).toBe(false);
    // the bundle names its courier page: THAT is the thing to publish
    const c = handoffFor({ host: 'claude-code', surface: 'box', artifact: { ...ZIP, courier: 'sk_x.courier.html' } });
    expect(c.next).toBe('publish sk_x.courier.html with your Artifact tool declaring capabilities { downloads: true }; its Save button hands sk_x.zip (5.7 MiB) to the operator through the viewer\'s download prompt — or push the outcome folder /box/outcomes/sk_x to the branch');
  });

  it('claude-code + surface unknown: both rows, local first, so the agent picks', () => {
    const n = handoffFor({ host: 'claude-code', artifact: PAGE });
    expect(n.surface).toBeNull();
    expect(n.door).toEqual({ local: 'dashboard', box: 'artifact' });
    expect(n.next).toMatch(/^On the operator's machine: open \/outcomes\/sk_x\/world\.html in the dashboard, or world\.html straight from file:\/\/.*\. Inside Claude Code on the web: publish world\.html/);
    expect(n.caveats).toEqual([expect.stringMatching(/^Claude Code on the web: this box is reclaimed/)]);
  });

  it('claude-code + local: the dashboard, no ephemeral caveat', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'local', artifact: GLB });
    expect(n.door).toBe('local');
    expect(n.next).toBe('the file is at /box/outcomes/sk_x/model.glb (3.4 MiB); the operator opens it from disk');
    expect(n.caveats).toEqual([]);
  });

  it('codex + box: the PR is the handoff, the page has no door', () => {
    const p = handoffFor({ host: 'codex', surface: 'box', artifact: PAGE });
    expect(p.door).toBe('none');
    expect(p.next).toMatch(/this host shows no page; the file is at \/box\/outcomes\/sk_x\/world\.html/);
    const f = handoffFor({ host: 'codex', surface: 'box', artifact: GLB });
    expect(f.next).toBe('commit /box/outcomes/sk_x (3.4 MiB) to the branch; the PR is the handoff');
    expect(f.caveats).toEqual([expect.stringMatching(/reclaimed/)]);
  });

  it('grok (Build CLI): local preview; grok-chat: file cards under 25 MB', () => {
    const g = handoffFor({ host: 'grok', artifact: PAGE });
    expect(g.surface).toBe('local');
    expect(g.next).toMatch(/open \/box\/outcomes\/sk_x\/world\.html \(8\.7 MiB\) in the host's preview, or from file:\/\//);
    const c = handoffFor({ host: 'grok-chat', artifact: GLB });
    expect(c.surface).toBe('box');
    expect(c.next).toBe('hand model.glb (3.4 MiB) back as a file card, ≤ 25.0 MiB; the operator saves it');
    const big = handoffFor({ host: 'grok-chat', artifact: { ...GLB, bytes: 30 * 1024 * 1024 } });
    expect(big.caveats[0]).toMatch(/over this host's file-card limit by 5\.0 MiB/);
  });

  it('muse + page: save with the Artifacts tool, in its own words; the inline page is fragile, not refused', () => {
    const cdn = handoffFor({ host: 'muse', artifact: { ...PAGE, name: 'world.cdn.html', bytes: 90_000 } });
    expect(cdn.surface).toBe('box');
    expect(cdn.door).toBe('artifact');
    expect(cdn.next).toBe("save world.cdn.html (88 KB) with your Artifacts tool (one HTML page); the operator opens it in their Library's Artifacts tab");
    expect(cdn.caveats).toEqual([]);
    const inline = handoffFor({ host: 'muse', artifact: { ...PAGE, bytes: 2 * 1024 * 1024, inlineScripts: true } });
    expect(inline.caveats).toEqual(['world.html carries three.js as inline `data:` modules, which are fragile on some of this host\'s mobile viewers: check it here from file:// (no network needed), then re-export with `cdn: true` and save world.cdn.html']);
    // Nothing Claude's leaks into another artifact host's note.
    expect(`${inline.next} ${inline.caveats.join(' ')}`).not.toMatch(/claude\.ai|CSP|ANY size|publish/);
  });

  // The Library shows only .html (operator, 2026-09-28: every other type mojulo writes was probed, none
  // surfaced). So a zip, a mesh or a folder rides the bundle's courier page, the export's folder page.
  it('muse + file: the Library shows only .html, so files ride the courier page', () => {
    const c = handoffFor({ host: 'muse', artifact: { ...ZIP, courier: 'sk_x.courier.html' } });
    expect(c.door).toBe('drop-folder');
    expect(c.next).toBe("copy sk_x.courier.html into ~/workspace/your_files/; it lands in the operator's Library as one page (the operator's Library shows only .html files) — the operator downloads it and opens it on their device to save sk_x.zip (5.7 MiB) or any file of the export");
    expect(c.caveats).toEqual([]);
    // a file with no courier is not sent into a folder the operator never sees; the note names the bundle
    const g = handoffFor({ host: 'muse', artifact: GLB });
    expect(g.next).toBe("the operator's Library shows only .html files, so model.glb would not surface there; it is at /box/outcomes/sk_x/model.glb (3.4 MiB)");
    expect(g.caveats).toEqual([expect.stringMatching(/format: 'bundle'.*courier\.html, one page that carries every file of the export/)]);
    // a folder has no extension to show and is outside the list too
    const f = handoffFor({ host: 'muse', artifact: { kind: 'folder', name: 'godot', path: '/box/outcomes/sk_x/godot' } });
    expect(f.next).toMatch(/^the operator's Library shows only \.html files, so the folder godot would not surface there/);
  });

  // the courier carries only what export_model's bundle zips, so a cook's or a game's folder, a single-format
  // export or a miniature's STL is never sent to the bundle (it used to say index.html was not .html enough, then
  // point at the bundle); the recipe clause names only what the exporter wrote (the artifacts are the producers' own:
  // cook.js hands off no recipe, export-game.js its recipe/, sketch-model-export.js the recipe.json beside the file)
  it('muse + a cook or game folder, a usdz or a miniature STL: named plainly as staying in the box, never sent to the bundle', () => {
    const cook = handoffFor({ host: 'muse', artifact: { kind: 'folder', name: 'index.html', path: '/box/outcomes/ck_x', dir: '/box/outcomes/ck_x' } });
    const game = handoffFor({ host: 'muse', artifact: { kind: 'folder', name: 'game.html', path: '/box/outcomes/sk_g/', dir: '/box/outcomes/sk_g/', bytes: 2048, recipe: 'recipe/' } });
    for (const [n, folder] of [[cook, 'ck_x'], [game, 'sk_g']]) {
      expect(n.next).toMatch(new RegExp(`^the operator's Library shows only \\.html files, so the folder ${folder} would not surface there; it is at /box/outcomes/${folder}`));
      expect(n.next).not.toMatch(/index\.html|game\.html/);
      expect(n.caveats.join()).not.toMatch(/bundle|recipe\.json/);
    }
    // a cook writes no recipe, so the note sends the agent to none
    expect(cook.caveats).toEqual(["the operator's Library cannot carry a folder, and no courier page carries it: tell the operator where it is in the box"]);
    expect(game.caveats).toEqual(["the operator's Library cannot carry a folder, and no courier page carries it: tell the operator where it is in the box, and hand over its recipe (recipe/ in the folder re-mints it on any host running mojulo)"]);
    const u = handoffFor({ host: 'muse', artifact: { kind: 'file', name: 'model.usdz', path: '/box/outcomes/sk_x/model.usdz', recipe: 'recipe.json' } });
    expect(u.next).toMatch(/so model\.usdz would not surface there/);
    expect(u.caveats).toEqual(["the operator's Library cannot carry a .usdz file, and no courier page carries it: tell the operator where it is in the box, and hand over its recipe (recipe.json beside it re-mints it on any host running mojulo)"]);
    // a miniature kind's STL is not in the bundle (bundleExport zips model.stl for literal kinds only), so it is not bundled
    const stl = handoffFor({ host: 'muse', artifact: { kind: 'file', name: 'model.stl', path: '/box/outcomes/sk_x/model.stl', recipe: 'recipe.json' } });
    expect(stl.next).toMatch(/so model\.stl would not surface there/);
    expect(stl.caveats).toEqual([expect.stringMatching(/cannot carry a \.stl file, and no courier page carries it: .*recipe\.json beside it/)]);
    expect(stl.caveats.join()).not.toMatch(/bundle/);
    const literal = handoffFor({ host: 'muse', artifact: { kind: 'file', name: 'model.stl', path: '/box/outcomes/sk_x/model.stl', recipe: 'recipe.json', bundled: true } });
    expect(literal.caveats).toEqual([expect.stringMatching(/format: 'bundle'.*courier\.html, one page that carries every file of the export/)]);
  });

  it('muse + an .html file: straight into the drop folder; no ceiling known, the VM persists', () => {
    const h = handoffFor({ host: 'muse', artifact: { kind: 'file', name: 'sk_x.courier.html', path: '/box/outcomes/sk_x/sk_x.courier.html', bytes: 300 * 1024 * 1024 } });
    expect(h.next).toBe("copy sk_x.courier.html (300.0 MiB) into ~/workspace/your_files/; it lands in the operator's Library");
    expect(h.caveats).toEqual([]);
  });

  it('asking for a surface the host has no row for says so and falls back', () => {
    const n = handoffFor({ host: 'desktop', surface: 'box', artifact: PAGE });
    expect(n.surface).toBe('local');
    expect(n.caveats[0]).toMatch(/no 'box' row; the local door/);
  });

  it('unknown host: the generic file:// sentence and the loopback caveat', () => {
    const n = handoffFor({ host: null, artifact: PAGE });
    expect(n.door).toBeNull();
    // A page without inline scripts is the `cdn: true` build: it needs the network for its
    // three.js, so the generic sentence says so; the default self-contained page keeps the promise.
    expect(n.next).toBe('the page is at /box/outcomes/sk_x/world.html; it opens straight from file:// — needs the network for three.js (the default, `cdn: false`, writes the self-contained world.html)');
    const offline = handoffFor({ artifact: { ...PAGE, inlineScripts: true } });
    expect(offline.next).toMatch(/no server, no network$/);
    expect(n.caveats).toEqual(['/outcomes/sk_x/world.html is reachable only from the machine mojulo runs on']);
    expect(handoffFor({ host: 'no-such-host', artifact: GLB }).next).toBe('the file is at /box/outcomes/sk_x/model.glb');
  });

  it('fitsBudget: null budget always fits; over_by is exact', () => {
    expect(fitsBudget(5, null)).toEqual({ fits: true, budget: null, over_by: 0 });
    expect(fitsBudget(20, 16)).toEqual({ fits: false, budget: 16, over_by: 4 });
    expect(fitsBudget(16, 16).fits).toBe(true);
  });
});

describe('host + surface resolution', () => {
  afterEach(() => _resetClientBindingsForTests());

  it('reads the session clientInfo through the adapter resolver', () => {
    rememberClientInfo('s1', { name: 'claude-code', version: '2.0' });
    rememberClientInfo('s2', { name: 'codex-cli', version: '1' });
    rememberClientInfo('s3', { name: 'Some Unknown Client', version: '1' });
    expect(resolveHandoffHost({ mcpSessionId: 's1' }, {})).toBe('claude-code');
    expect(resolveHandoffHost({ mcpSessionId: 's2' }, {})).toBe('codex');
    expect(resolveHandoffHost({ mcpSessionId: 's3' }, {})).toBeNull();
    expect(resolveHandoffHost({ mcpSessionId: 'never-initialized' }, {})).toBeNull();
  });

  it('MOJULO_HOST=muse resolves the Muse door table for a CLI call', () => {
    expect(resolveHandoffHost({}, { MOJULO_HOST: 'muse' })).toBe('muse');
    expect(handoffForContext({}, GLB, { MOJULO_HOST: 'muse' }).door).toBe('drop-folder');
  });

  it('MOJULO_HOST / context.host win, and an unknown id is ignored', () => {
    rememberClientInfo('s1', { name: 'claude-code' });
    expect(resolveHandoffHost({ mcpSessionId: 's1' }, { MOJULO_HOST: 'grok-chat' })).toBe('grok-chat');
    expect(resolveHandoffHost({ mcpSessionId: 's1', host: 'codex' }, {})).toBe('codex');
    expect(resolveHandoffHost({ mcpSessionId: 's1' }, { MOJULO_HOST: 'bogus' })).toBe('claude-code');
    expect(resolveHandoffSurface({}, { MOJULO_SURFACE: 'box' })).toBe('box');
    expect(resolveHandoffSurface({ surface: 'local' }, {})).toBe('local');
    expect(resolveHandoffSurface({}, { MOJULO_SURFACE: 'cloud' })).toBeNull();
  });

  it('handoffForContext is the one-call form a tool result uses', () => {
    rememberClientInfo('s1', { name: 'claude-code' });
    const n = handoffForContext({ mcpSessionId: 's1' }, PAGE, { MOJULO_SURFACE: 'box' });
    expect(n.host).toBe('claude-code');
    expect(n.surface).toBe('box');
    expect(n.next).toMatch(/Artifact tool/);
  });
});


describe('ChatGPT handoff contract', () => {
  it.each([PAGE, GLB, ZIP])('keeps Work-box delivery conditional for $name', (artifact) => {
    const note = handoffFor({ host: 'chatgpt', surface: 'box', artifact });
    expect(note.door).toBe('session-file');
    expect(note.next).toContain('available file attachment/download tool');
    expect(note.next).toContain('if no delivery tool is available');
    expect(note.next).not.toMatch(/commit|publish|courier|sandbox:/);
    expect(note.caveats.join(' ')).toContain('recipe.json');
    expect(note.verified).toBe('inferred');
  });

  it('never treats an MCP-server path as a session attachment', () => {
    const note = handoffFor({ host: 'chatgpt', surface: 'local', artifact: GLB });
    expect(note.door).toBe('server-file');
    expect(note.next).toContain('report delivery as incomplete');
    expect(note.caveats.join(' ')).toContain('does not automatically share this filesystem');
  });

  it('states both paths when execution location is unknown', () => {
    const note = handoffFor({ host: 'chatgpt', artifact: ZIP });
    expect(note.surface).toBeNull();
    expect(note.next).toContain('Through connected MCP:');
    expect(note.next).toContain('Inside ChatGPT');
    expect(note.door).toEqual({ local: 'server-file', box: 'session-file' });
  });

  it('resolves an explicit shell host without MCP initialization', () => {
    expect(resolveHandoffHost({}, { MOJULO_HOST: 'chatgpt' })).toBe('chatgpt');
  });
});
