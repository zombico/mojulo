import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  CAPTURE_GLOBAL, CAPTURE_READY, CAPTURE_FRAME, CAPTURE_STEP, CAPTURE_PROBE,
  CAPTURE_COMPILE_WALK_TO, PROBE_FIELDS, WORLD_ROOT_SELECTOR, WORLD_HIDE_SELECTORS,
} from './capture-contract.js';
import { EMIT_FIXTURES } from './emit-fixtures.js';
import { emitThreeWorld } from './scene-three.js';

// ── the parse gate (renderer-emitter.plan.md E3) ───────────────────────────────────
// Every channel combination in the fixture matrix must emit a page whose module
// script PARSES — checked with V8 itself (`node --check --input-type=module`), no
// browser. This is what catches a typo in a rarely-used channel combination at test
// time instead of at Chromium time. Plus: the capture page must actually publish
// every name in capture-contract.js (drift detection for the node↔browser seam).

const moduleScripts = (html) => {
  const out = [];
  const re = /<script type="module">([\s\S]*?)<\/script>/g;
  for (let m; (m = re.exec(html)); ) out.push(m[1]);
  return out;
};

const parses = (src) => {
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    return String(e.stderr || e.message).slice(0, 400);
  }
};

describe('emitted page scripts parse for every channel combination', () => {
  it.each(EMIT_FIXTURES.map(([name]) => name))('%s parses', (name) => {
    const [, opts] = EMIT_FIXTURES.find(([n]) => n === name);
    const html = emitThreeWorld(opts);
    const scripts = moduleScripts(html);
    expect(scripts.length, 'page has a module script').toBeGreaterThan(0);
    for (const src of scripts) expect(parses(src)).toBeNull();
    // the importmap must be valid JSON too
    const im = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
    if (im) expect(() => JSON.parse(im[1])).not.toThrow();
  });

  it('a hostile </script> payload still parses (safeJson holds under the gate)', () => {
    const html = emitThreeWorld({
      faces: [{ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888888' }],
      signs: [{ id: 's1', variant: 'toast', anchor: { kind: 'slot', slot: 'top' }, text: 'x</script><script>alert(1)</script>', body: [], chrome: {} }],
    });
    for (const src of moduleScripts(html)) expect(parses(src)).toBeNull();
  });
});

describe('capture page publishes the capture-contract names', () => {
  const html = emitThreeWorld({
    faces: [{ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#445566' }],
    entities: [{ id: 'd', transform: { pos: [1, 1, 0], heading: 0 }, rule: { type: 'walk' }, body: { type: 'mesh' } }],
    capture: true,
  });
  // a rigged capture page (a layered hero's packed figure carrying `preview`) — the rig preview
  // channel injects its clip <select> from script, so its hide class is set via `className`
  const fig = { rig: true, bones: [{ id: 'root', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [{ pos: 'AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', col: 'AAAAAAAAAAAAAAAA', faces: 1 }], clips: { idle: { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1] } }, figH: 1 };
  const rigged = emitThreeWorld({
    faces: [{ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]], fill: '#888', group: 'body' }],
    figures: { body: { ...fig, preview: { clips: ['idle'], hide: 'body', period: 2 } } },
    capture: true,
  });
  const tags = (page, cls) => page.includes(`class="${cls}`) || page.includes(`className = '${cls}'`);

  it('bridge global, readiness flag, and every method', () => {
    expect(html).toContain(`window.${CAPTURE_GLOBAL} = {`);
    expect(html).toContain(`${CAPTURE_READY}: true`);
    for (const m of [CAPTURE_FRAME, CAPTURE_STEP, CAPTURE_COMPILE_WALK_TO]) {
      expect(html).toContain(`${m}(spec)`);
    }
    expect(html).toContain(`${CAPTURE_PROBE}()`);
  });

  it('probe shape and screenshot selectors', () => {
    // the probe() result literal carries every contract field as a key
    expect(html).toContain(`{ ${PROBE_FIELDS.map((f) => `${f}:`).join(' ')}`.split(' ')[1]); // 't:' anchor
    for (const f of PROBE_FIELDS) expect(html).toContain(`${f}:`);
    expect(html).toContain(`id="${WORLD_ROOT_SELECTOR.slice(1)}"`);
    for (const sel of WORLD_HIDE_SELECTORS) expect(tags(html, sel.slice(1)) || tags(rigged, sel.slice(1)), sel).toBe(true);
  });

  it('a rigged capture hides the rig preview clip <select>; the live page keeps it', () => {
    // the drivers display:none every WORLD_HIDE_SELECTORS match, so the tagged <select> bakes out
    expect(WORLD_HIDE_SELECTORS).toContain('.rig-preview');
    expect(rigged).toMatch(/createElement\('select'\);\s*sel\.className = 'rig-preview';/);
    // hiding is the capture drivers' job — the page itself never styles the picker away
    expect(rigged).not.toMatch(/\.rig-preview\s*\{[^}]*display\s*:\s*none/);
  });
});
