import { describe, it, expect } from 'vitest';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from '../ui/cues.js';
import { lowerPlay, resolvePlayUi } from '../ui/direction.js';
import { uiBoardHtml } from '../ui/board-html.js';
import { BEAMS, BEAM_NAMES, readBeam, readStrand, strandPoints, beamLanding, beamLength, beamSignature } from './beams.js';

const CW = composeLive();
const DT = 1 / 30;
const A = [0, 0, 1.15], B = [10, 0, 0.9];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

describe('a strand', () => {
  it('nothing before it goes; a head that lands on B when the landing says; deterministic', () => {
    for (const name of BEAM_NAMES) {
      const S = BEAMS[name].strands[0], [[a, b]] = beamLanding({ strands: [S] }), hit = a + b * dist(A, B);
      expect(strandPoints(S, A, B, S.delay * 0.99, 0).spine).toEqual([]);
      const at = strandPoints(S, A, B, hit - 1e-5, 0);
      expect(dist(at.spine.at(-1).p, B)).toBeLessThan(S.speed * 2e-5);   // the front is on the target as it lands
      const before = strandPoints(S, A, B, hit - 0.02, 0);
      expect(dist(before.spine.at(-1).p, B)).toBeGreaterThan(1e-3);
      expect(strandPoints(S, A, B, hit * 0.7, 0)).toEqual(strandPoints(S, A, B, hit * 0.7, 0));
      expect(strandPoints(S, A, B, beamLength(BEAMS[name], dist(A, B)) + 0.5, S.count - 1).spine).toEqual([]);   // all gone by its length
    }
  });

  it('a slither and a braid leave the hand and meet the target; their bodies swing between', () => {
    for (const name of ['serpent', 'braid']) {
      const S = BEAMS[name].strands[0];
      const t = S.form === 'ray' ? S.delay + dist(A, B) / S.speed + 0.1 : S.delay + 0.95;
      const sp = strandPoints(S, A, B, t, 0, 64).spine;
      if (S.form === 'ray') expect(dist(sp[0].p, A)).toBeLessThan(1e-9);
      const off = Math.max(...sp.map((q) => Math.hypot(q.p[1], q.p[2] - 1)));
      expect(off).toBeGreaterThan(0.2);
    }
    // the braid's two strands sit across the line from each other
    const [s0, s1] = BEAMS.braid.strands, t = s0.delay + 0.5;
    const m0 = strandPoints(s0, A, B, t, 0, 41).spine[10].p, m1 = strandPoints(s1, A, B, t, 0, 41).spine[10].p;
    expect(m0[1] * m1[1]).toBeLessThanOrEqual(1e-9);
  });

  it('a barrage: copies at their own times and speeds, each curving its own way, all on the target', () => {
    const S = BEAMS.barrage.strands[0], ends = [];
    for (let j = 0; j < S.count; j++) {
      const r = strandPoints(S, A, B, 0.45, j, 32);
      if (r.spine.length) ends.push(r.spine.at(-1).p);
      const late = strandPoints(S, A, B, 30, j, 32);
      expect(late.spine).toEqual([]);
    }
    expect(new Set(ends.map((p) => p.map((v) => v.toFixed(2)).join())).size).toBe(ends.length);
    expect(ends.length).toBeGreaterThan(3);
  });

  it('reads and teaches; presets read apart in values', () => {
    expect(() => readStrand({ form: 'wave' }, 's')).toThrow(/s.form is ray or bolt/);
    expect(() => readStrand({ twist: 0.5 }, 's')).toThrow(/give wave: \[amp, 0\]/);
    expect(() => readStrand({ speeed: 3 }, 's')).toThrow(/s has no speeed/);
    expect(() => readBeam({ strands: [] }, 'b')).toThrow(/b.strands is one strand or a list/);
    expect(() => readBeam({ strands: {}, impact: 'boom' }, 'b')).toThrow(/b.impact is a puff where it lands/);
    expect(() => readBeam('hadoken', 'b')).toThrow(/is not an attack: name a preset \(orb, serpent/);
    // the charge comes first: every strand waits for it
    expect(readBeam({ charge: { time: 1 }, strands: { delay: 0.2 } }, 'b').strands[0].delay).toBeCloseTo(1.2, 9);
    const sigs = BEAM_NAMES.map((n) => beamSignature(BEAMS[n]));
    expect(new Set(sigs).size).toBe(BEAM_NAMES.length);
  });
});

describe('the engine', () => {
  const ents = () => [
    { id: 'hero', rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85], heading: 0 }, body: { type: 'none' } },
    { id: 'golem', rule: { type: 'static' }, transform: { pos: [10, 0, 0.9] }, body: { type: 'none' } },
  ];
  it('fires from the hand, lands on schedule, puts down its impact and shake then, and struck fires once', () => {
    const w = CW.createWorld({ entities: ents() });
    let prev = CW.castFacts(w, undefined).prev;
    CW.stepWorld(w, {}, DT);
    const spec = BEAMS.ray, t0 = w.time;
    CW.castOps(w, [{ op: 'beam', who: 'hero', to: 'golem', spec, land: beamLanding(spec), name: 'ray' }]);
    const M = w.moments.find((m) => m.is === 'beam');
    expect(M.from).toEqual([0.45, 0, 1.15]);
    expect(M.to).toEqual([10, 0, 0.9]);
    const hit = t0 + spec.strands[0].delay + dist(M.from, M.to) / spec.strands[0].speed;
    expect(M.hit).toBeCloseTo(hit, 9);
    expect(w.moments.filter((m) => m.t0 === M.hit).map((m) => m.is)).toEqual(['flash', 'shake']);
    const struck = [];
    for (let i = 0; i < 120; i++) { CW.stepWorld(w, {}, DT); const f = CW.castFacts(w, prev); prev = f.prev; for (const e of f.events) if (e.type === 'struck') struck.push([e.entity, e.by, e.beam, w.time >= M.hit]); }
    expect(struck).toEqual([['golem', 'hero', 'ray', true]]);
  });

  it('over the head when its charge says so; at a point; none at a character gone', () => {
    const w = CW.createWorld({ entities: ents() });
    CW.castOps(w, [{ op: 'beam', who: 'hero', to: [5, 5], spec: BEAMS.nova, land: beamLanding(BEAMS.nova) }]);
    expect(w.moments[0]).toMatchObject({ from: [0, 0, 2.7], to: [5, 5, 0] });
    expect(w.moments[0]).not.toHaveProperty('target');
    CW.castOps(w, [{ op: 'vanish', who: 'golem' }, { op: 'beam', who: 'hero', to: 'golem', spec: BEAMS.orb, land: beamLanding(BEAMS.orb) }]);
    expect(w.moments.filter((m) => m.is === 'beam')).toHaveLength(1);
  });
});

describe('beams in the cues', () => {
  const ENTS = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'none' } }, { id: 'golem', rule: { type: 'static' }, transform: { pos: [8, 0, 0] }, body: { type: 'none' } }];
  it('reads a preset, a play.beams name or a spec; at a character or a place; struck; the board says them', () => {
    const play = { spots: [{ id: 'altar', at: [4, 4] }], beams: { twin: { strands: [{ form: 'ray', twist: 0.5, wave: [0.4, 0] }, { form: 'ray', twist: 0.5, wave: [0.4, 0], phase: 0.5 }] } }, cues: [
      { id: 'a', when: { start: true }, then: [{ beam: { who: 'hero', to: 'golem', is: 'ray' } }, { beam: { who: 'hero', to: 'altar', is: 'twin', color: 'copper' } }, { beam: { who: 'hero', to: [1, 2], is: { strands: { form: 'bolt', speed: 5 } } } }] },
      { id: 'b', when: { struck: 'golem' }, then: { hurt: { who: 'golem', by: 20 } } },
    ] };
    const ev = lowerPlay({ entities: ENTS, play }, { player: 'hero' });
    const rs = ev.reactions.filter((r) => r.op === 'beam');
    expect(rs.map((r) => [r.to, r.name, r.color])).toEqual([['golem', 'ray', undefined], [[4, 4, 0], 'twin', 'copper'], [[1, 2, 0], undefined, undefined]]);
    expect(rs[0].spec).toEqual(BEAMS.ray);
    expect(rs[0].land).toEqual(beamLanding(BEAMS.ray));
    expect(rs[1].spec.strands).toHaveLength(2);
    expect(ev.reactions.some((r) => r.on === 'struck' && r.match && r.match.entity === 'golem')).toBe(true);
    const bad = (then) => () => readCues({ cues: [{ id: 'x', when: { start: true }, then }] });
    expect(bad({ beam: { who: 'hero' } })).toThrow(/beam.to is a character's id or a place/);
    expect(bad({ beam: { who: 'hero', to: 'golem', is: 'hadoken' } })).toThrow(/is not an attack/);
    const html = uiBoardHtml(resolvePlayUi({ entities: ENTS, play: { ...play, ui: 'propose' } }, () => 7));
    for (const w of ['hero fires a ray at golem', 'hero fires a twin at altar', 'hero fires an attack at [1, 2]']) expect(html).toContain(w);
  });
});

describe('the page', () => {
  const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }, { id: 'golem', rule: { type: 'static' }, transform: { pos: [8, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [1, 1, 1.7] } }];
  const page = async (then) => {
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    return emitThreeWorld({ entities, events: lowerPlay({ entities, play: { cues: [{ id: 'x', when: { start: true }, then }] } }, { player: 'hero' }), inline: false });
  };
  it('carries the beam code and its impact\'s moment only when a cue fires one, and only the layers it uses', async () => {
    const ray = await page({ beam: { who: 'hero', to: 'golem', is: 'ray' } });
    expect(ray).toContain('__stepBeams();');
    expect(ray).toContain('const __bmWave = ');   // its charge
    expect(ray).toContain('I.rings = ');
    expect(ray).not.toContain('const __bmSpray = ');
    expect(ray).toContain('__stepMoments();');    // its flash and shake
    expect(ray).toContain('const __moShake = ');
    const laser = await page({ beam: { who: 'hero', to: 'golem', is: 'laser' } });
    expect(laser).not.toContain('const __bmWave = ');
    expect(laser).not.toContain('const __moShake = ');
    expect(await page({ kill: 'hero' })).not.toContain('__stepBeams');
  });

  it('the page source compiles with every preset, and its strand is the module\'s', async () => {
    const { beamScript } = await import('../../scene/channels/beam-channel.js');
    const all = beamScript(Object.values(BEAMS));
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${all}; return 1;`)).not.toThrow();
    const at = all.indexOf('const __bmStrand = '), end = all.indexOf('\n', all.indexOf('\n}', at) + 1);
    const fn = new Function(`${all.slice(at, end)}; return __bmStrand;`)();
    expect(fn(BEAMS.serpent.strands[0], A, B, 1.1, 0, 30)).toEqual(strandPoints(BEAMS.serpent.strands[0], A, B, 1.1, 0, 30));
  });
});
