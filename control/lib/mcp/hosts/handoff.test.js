/**
 * The handoff note (remote-worker exports P4): one expected `next` per host
 * and surface, the two-row note when the surface is unknown, the generic
 * fallback, and host resolution from clientInfo / MOJULO_HOST.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { handoffFor, handoffForContext, resolveHandoffHost, resolveHandoffSurface, fitsBudget } from './handoff.js';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';

const PAGE = { kind: 'page', name: 'world.html', path: '/box/outcomes/sk_x/world.html', dir: '/box/outcomes/sk_x', bytes: 9_100_000, download_url: '/outcomes/sk_x/world.html' };
const GLB = { kind: 'file', name: 'model.glb', path: '/box/outcomes/sk_x/model.glb', dir: '/box/outcomes/sk_x', bytes: 3_600_000, download_url: '/outcomes/sk_x/model.glb' };
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

  // cdn-default: the regression the flip exists for. Before it, the CSP advisory rode inside
  // the over-budget branch, so a page that FITS the 16 MiB door — the overwhelmingly common
  // case — was waved through and then rendered black behind the host's `script-src`. Size and
  // CSP are independent facts about the door and each gets its own caveat.
  it('claude-code + an inline-script page that FITS: the CSP caveat fires on size alone being fine', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: { ...PAGE, name: 'world.offline.html', bytes: 2 * 1024 * 1024, inlineScripts: true } });
    expect(n.next).toMatch(/publish world\.offline\.html/);
    expect(n.caveats[0]).toMatch(/refuses at ANY size/);
    expect(n.caveats[0]).toMatch(/cdn\.jsdelivr\.net\/npm\//);
    // it fits, so NO byte caveat rides along
    expect(n.caveats.join(' ')).not.toMatch(/over this host's page limit/);
  });

  it('claude-code + the default CDN page that fits: no CSP caveat at all', () => {
    const n = handoffFor({ host: 'claude-code', surface: 'box', artifact: { ...PAGE, bytes: 2 * 1024 * 1024 } });
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

  it('asking for a surface the host has no row for says so and falls back', () => {
    const n = handoffFor({ host: 'desktop', surface: 'box', artifact: PAGE });
    expect(n.surface).toBe('local');
    expect(n.caveats[0]).toMatch(/no 'box' row; the local door/);
  });

  it('unknown host: the generic file:// sentence and the loopback caveat', () => {
    const n = handoffFor({ host: null, artifact: PAGE });
    expect(n.door).toBeNull();
    // cdn-default: the default page needs the network for its three.js, so the generic sentence
    // no longer promises otherwise; the self-contained build is the one that keeps that promise.
    expect(n.next).toBe('the page is at /box/outcomes/sk_x/world.html; it opens straight from file:// — needs the network for three.js (`cdn: false` writes the self-contained page)');
    const offline = handoffFor({ artifact: { ...PAGE, name: 'world.offline.html', inlineScripts: true } });
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
