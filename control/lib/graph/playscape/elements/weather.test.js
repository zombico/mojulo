import { describe, it, expect } from 'vitest';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from '../ui/cues.js';
import { lowerPlay, resolvePlayUi } from '../ui/direction.js';
import { uiBoardHtml } from '../ui/board-html.js';
import { LOOKS, readLook, readSpray, sprayPoints, valueSignature } from './elements.js';
import { MOMENTS, PUFFS, momentSpec, strikeBolt } from './moments.js';

const CW = composeLive();
const DT = 1 / 30;

describe('the spray', () => {
  it('one entry a particle, always; deterministic in t; a loop is born again', () => {
    const S = LOOKS.embers.drift[0];
    for (const t of [0, 0.7, 3.3, 41]) {
      const a = sprayPoints(S, [1, 2, 0], t, true);
      expect(a).toHaveLength(S.count);
      expect(sprayPoints(S, [1, 2, 0], t, true)).toEqual(a);
      expect(a.filter((q) => q.w > 0).length).toBeGreaterThan(S.count / 3);   // a loop keeps most of them alive
    }
    // a moment's spray goes once: nothing before its delay, nothing after its lives
    const B = MOMENTS.fireworks.parts[1];
    expect(sprayPoints(B, [0, 0, 0], 0.3, false).every((q) => q.w === 0)).toBe(true);
    expect(sprayPoints(B, [0, 0, 0], 1.2, false).some((q) => q.w > 0)).toBe(true);
    expect(sprayPoints(B, [0, 0, 0], 4, false).every((q) => q.w === 0)).toBe(true);
  });

  it('rises, falls, swirls and lands as it says; a drop that lands rings out on the ground', () => {
    const up = sprayPoints(LOOKS.embers.drift[0], [0, 0, 0], 5, true).filter((q) => q.w > 0);
    expect(up.every((q) => q.v[2] > 0)).toBe(true);
    const rain = LOOKS.rain.drift[0];
    let rings = 0;
    for (let t = 0; t < 2; t += 0.05) for (const q of sprayPoints(rain, [0, 0, 0], t, true)) {
      expect(q.p[2]).toBeGreaterThanOrEqual(-1e-9);   // never under the feet's ground
      expect(q.p[2]).toBeLessThanOrEqual(2.46);
      if (q.ring >= 0) { rings++; expect(q.p[2]).toBeCloseTo(0, 6); expect(q.w).toBe(0); }
    }
    expect(rings).toBeGreaterThan(20);
    // the wind goes round: its streaks keep their distance from the body's axis
    for (const q of sprayPoints(LOOKS.wind.drift[0], [0, 0, 0], 2.2, true)) if (q.w > 0) expect(Math.hypot(q.p[0], q.p[1])).toBeCloseTo(0.9, 6);
  });

  it('reads and teaches; drift and bright bolts are their own values', () => {
    expect(readSpray({}, 's')).toMatchObject({ glyph: 'dot', count: 12, from: 'shell', el: [-90, 90], go: [0, 0, 0], env: 'out' });
    expect(() => readSpray({ glyph: 'heart' }, 's')).toThrow(/s.glyph is one of: dot, soft, streak/);
    expect(() => readSpray({ from: 'sky' }, 's')).toThrow(/s.from is one of: point, ground, shell, cloud/);
    expect(() => readSpray({ el: [0, 120] }, 's')).toThrow(/degrees in -90..90/);
    expect(() => readSpray({ go: [1, 2] }, 's')).toThrow(/s.go is \[x, y, z\]/);
    expect(() => readLook({ drift: { count: 0 } }, 'L')).toThrow(/L.drift.count is how many particles/);
    const black = readLook({ bolts: true }, 'L'), white = readLook({ bolts: { bright: true } }, 'L');
    expect(valueSignature(black)).not.toBe(valueSignature(white));
    expect(valueSignature(black).startsWith('dark')).toBe(true);
    expect(valueSignature(white).startsWith('light')).toBe(true);
  });
});

describe('moments', () => {
  it('every kind is sprays and a star, bolt, ring or light; a colour paints its key part', () => {
    expect(PUFFS).toEqual(['smoke', 'dust', 'splash', 'flash', 'strike', 'sparks', 'fireworks']);
    for (const k of PUFFS) { expect(MOMENTS[k].dur).toBeLessThanOrEqual(3); expect(MOMENTS[k].parts.length).toBeGreaterThan(0); }
    expect(momentSpec('fireworks', '#00ff00').parts.map((p) => p.color)).toEqual([MOMENTS.fireworks.parts[0].color, [0, 1, 0], MOMENTS.fireworks.parts[2].color]);
    expect(momentSpec('flash', 'copper').star.color).toEqual(momentSpec('flash', 'copper').parts[0].color);
    expect(momentSpec('smoke')).toBe(MOMENTS.smoke);
  });

  it('a strike comes down from the sky onto the spot, a new path each strike', () => {
    const a = strikeBolt([3, 4, 0], 14, 0), b = strikeBolt([3, 4, 0], 14, 1);
    expect(a[0].nodes[0][2]).toBeCloseTo(14, 9);
    expect(a[0].nodes.at(-1)).toEqual([3, 4, 0]);
    expect(a[0].nodes).not.toEqual(b[0].nodes);
    expect(strikeBolt([3, 4, 0], 14, 0)).toEqual(a);
  });

  it('the engine keeps a puff at the feet with its colour, and a shake (on its own or a puff\'s)', () => {
    const w = CW.createWorld({ entities: [{ id: 'hero', rule: { type: 'walk', eye: 0.85 }, transform: { pos: [2, 3, 0.85] }, body: { type: 'none' } }] });
    CW.stepWorld(w, {}, DT);
    CW.castOps(w, [{ op: 'puff', who: 'hero', is: 'splash', color: '#00ffff', shake: 0.5 }, { op: 'shake', k: 0.8, for: 1 }, { op: 'puff', at: [5, 5], is: 'strike' }]);
    expect(w.moments.map(({ t0, ...m }) => m)).toEqual([
      { is: 'splash', at: [2, 3, 0], color: '#00ffff' },
      { is: 'shake', at: [2, 3, 0], k: 0.5, for: 0.4 },
      { is: 'shake', at: [0, 0, 0], k: 0.8, for: 1 },
      { is: 'strike', at: [5, 5, 0] },
    ]);
  });
});

describe('moments in the cues', () => {
  const ENTS = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [2, 3, 0] }, body: { type: 'none' } }];
  it('read, teach, lower, and the board says them', () => {
    const play = { spots: [{ id: 'well', at: [4, 4] }], cues: [{ id: 'a', when: { start: true }, then: [
      { puff: { who: 'hero', is: 'strike', shake: 0.6 } }, { puff: { at: 'well', is: 'fireworks', color: 'strontium' } }, { shake: 0.4 }, { shake: { k: 1, for: 2 } },
    ] }] };
    const ev = lowerPlay({ entities: ENTS, play }, { player: 'hero' });
    expect(ev.reactions.filter((r) => r.do === 'ctrl')).toEqual([
      { on: 'cue:a', do: 'ctrl', op: 'puff', who: 'hero', is: 'strike', shake: 0.6 },
      { on: 'cue:a', do: 'ctrl', op: 'puff', is: 'fireworks', color: 'strontium', at: [4, 4, 0] },
      { on: 'cue:a', do: 'ctrl', op: 'shake', k: 0.4 },
      { on: 'cue:a', do: 'ctrl', op: 'shake', k: 1, for: 2 },
    ]);
    const bad = (then) => () => readCues({ cues: [{ id: 'x', when: { start: true }, then }] });
    expect(bad({ puff: { who: 'hero', is: 'confetti' } })).toThrow(/is is one of: smoke, dust, splash, flash, strike, sparks, fireworks/);
    expect(bad({ puff: { at: [0, 0], shake: 3 } })).toThrow(/shake is how hard the camera shakes, 0..1/);
    expect(bad({ shake: 0 })).toThrow(/shake is how hard, 0..1, or \{ k, for\? \}/);
    expect(bad({ shake: { k: 0.5, for: 9 } })).toThrow(/for is seconds/);
    const html = uiBoardHtml(resolvePlayUi({ entities: ENTS, play: { ...play, ui: 'propose' } }, () => 7));
    for (const w of ['a lightning strike on hero (shakes)', 'fireworks at well', 'the camera shakes (0.4)']) expect(html).toContain(w);
  });
});

describe('the page', () => {
  const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
  const page = async (then) => {
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    return emitThreeWorld({ entities, events: lowerPlay({ entities, play: { cues: [{ id: 'x', when: { start: true }, then }] } }, { player: 'hero' }), inline: false });
  };

  it('carries the moments it uses, and only them; nothing for a world that puffs nothing', async () => {
    const js = await page([{ puff: { who: 'hero', is: 'strike' } }]);
    expect(js).toContain('__stepMoments();');
    expect(js).toContain('function __moStroke(');
    expect(js).toContain('const __moLight = ');
    expect(js).not.toContain('const __moShake = ');
    expect(js).not.toContain('"fireworks"');
    const quake = await page({ shake: 0.5 });
    expect(quake).toContain('const __moShake = ');
    expect(quake).not.toContain('function __moStroke(');
    for (const plain of [await page({ kill: 'hero' }), await page({ status: { who: 'hero', is: 'warded', look: 'ring' } })]) {
      expect(plain).not.toContain('__stepMoments');
      expect(plain).not.toContain('__mojGlyphs');
    }
    // a drifting look carries the glyphs and the spray, a still one does not
    expect(await page({ status: { who: 'hero', is: 'soaked', look: 'rain' } })).toContain('function __sprMake(');
  });

  it('the page source compiles with every kind, every preset; its spray and bolt are the module\'s', async () => {
    const { momentScript } = await import('../../scene/channels/moment-channel.js');
    const { statusScript } = await import('../../scene/channels/status-channel.js');
    const all = momentScript([...PUFFS, 'shake']);
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${all}; return 1;`)).not.toThrow();
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'location', 'window', 'document', `${statusScript(LOOKS)}; return 1;`)).not.toThrow();
    const grab = (name) => { const at = all.indexOf(`const ${name} = `), end = all.indexOf('\n', all.indexOf('\n}', at) + 1); return all.slice(at, end); };
    const spray = new Function(`${grab('__moSpray')}; return __moSpray;`)(), bolt = new Function(`${grab('__moBolt')}; return __moBolt;`)();
    expect(spray(MOMENTS.splash.parts[0], [1, 1, 0], 0.4, false)).toEqual(sprayPoints(MOMENTS.splash.parts[0], [1, 1, 0], 0.4, false));
    expect(bolt([0, 0, 0], 14, 2)).toEqual(strikeBolt([0, 0, 0], 14, 2));
  });
});

describe('the shake, run', () => {
  // the few THREE pieces a shake-only page touches
  class V { constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); } sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); } lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; } copy(v) { return this.set(v.x, v.y, v.z); } toArray() { return [this.x, this.y, this.z]; } }
  const THREE = { Vector3: V, CanvasTexture: class {} };
  it('moves the camera for the draw and puts it back after; dies away; none once it is over', async () => {
    const { momentScript } = await import('../../scene/channels/moment-channel.js');
    const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
    const document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    const camera = { position: new V(1, 2, 3) }, seen = [];
    const renderer = { render: (s, c) => seen.push(c.position.toArray()), domElement: { width: 800, height: 450 } };
    const world = { time: 0, moments: [{ is: 'shake', k: 1, for: 0.4, t0: 0, at: [0, 0, 0] }] };
    const window = { __mojCtrl: { world } };
    new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${momentScript(['shake'])}; window.__step = __stepMoments;`)(THREE, { add() {}, remove() {} }, camera, renderer, window, document);
    const at = (t) => { world.time = t; window.__step(); renderer.render(null, camera); return seen.at(-1); };
    const d = (p) => Math.hypot(p[0] - 1, p[1] - 2, p[2] - 3);
    expect(d(at(0.05))).toBeGreaterThan(0.01);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);   // taken off after the draw
    let early = 0, late = 0;
    for (let i = 0; i < 20; i++) { early = Math.max(early, d(at(0.02 + i * 0.004))); late = Math.max(late, d(at(0.3 + i * 0.004))); }
    expect(late).toBeLessThan(early);
    expect(d(at(0.5))).toBe(0);
  });
});
