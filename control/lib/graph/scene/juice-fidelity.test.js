// Juice at a fidelity, and the hero's movement juice. The concepts: the floor's fidelity read and refused, 'era' drawn
// at the read's; each fidelity's composition (a voxel world's blocks on twos with no thrown light and a flat pool, the
// sixth generation's light painted as a pool, the seventh's bloom and more thrown light) and none without the word; an
// explosion's pool and bloom, its length covering them; the page emitting the voxel glyph, the pool and the bloom only
// where a floor uses them. A machine's juice at the venue's and the read's fidelity (the paint written as none). A
// hero's movement juice by game type (the platformer's and pinball's, none for the others) at the body's anchors, and
// the page reading the platform rule's facts only for one. A gameworld stamping its fidelity from its venue.
import { describe, it, expect } from 'vitest';
import { readJuiceStyle, juiceFloor, juiceSignature, fidelityOfRead, JUICE_FIDELITIES } from './juice-style.js';
import { styleExplosion, puffSpec } from './effect-style.js';
import { eventsChannelScript } from './channels/events.js';
import { controllableChannelScript } from './channels/controllable/index.js';
import { rigFidelity, bakeJuice, JUICE } from '../car-designer/juice.js';
import { heroJuice, HERO_JUICE, HERO_JUICE_FLAVORS } from '../gameworld/feel/hero-juice.js';
import { JUICE_FLAVOR_IDS } from './juice-style.js';
import { juiceOfGame } from '../gameworld/juice.js';
import { STADIUM_PRESETS, STADIUM_PRESET_IDS } from '../stadium/stadium-words.js';

const base = { register: 'western', flavor: 'action' };
const burst = (F) => styleExplosion(puffSpec('flash'), 'flash', F);
const puffWorld = (fxStyle) => ({ cast: true, fxStyle, reactions: [{ do: 'ctrl', op: 'puff', is: 'flash', at: [0, 0, 0] }] });

describe('the floor at a fidelity', () => {
  it('reads its word and refuses another; era is drawn at the read\'s', () => {
    expect(readJuiceStyle({ ...base, fidelity: 'voxel' }).fidelity).toBe('voxel');
    expect(readJuiceStyle(base).fidelity).toBeUndefined();
    expect(() => readJuiceStyle({ ...base, fidelity: 'gen-8' })).toThrow(/fidelity is voxel \| paint \| form \| era/);
    expect(fidelityOfRead('era', 'gen-7')).toBe('form');
    expect(fidelityOfRead('era', 'gen-6')).toBe('paint');
    expect(fidelityOfRead('voxel', 'gen-7')).toBe('voxel');
    expect(fidelityOfRead(undefined, 'gen-7')).toBeUndefined();
  });
  it('composes each fidelity\'s drawing, and nothing without one', () => {
    const plain = juiceFloor(base), [vox, paint, form] = ['voxel', 'paint', 'form'].map((f) => juiceFloor({ ...base, fidelity: f }));
    for (const k of ['fidelity', 'pool', 'bloom']) expect(plain[k]).toBeUndefined();
    expect(juiceSignature(plain).look).not.toMatch(/pool|bloom/);
    // the blocks: every particle a cube, on twos, no thrown light
    expect(vox.sparks.glyph).toBe('cube');
    expect(Object.values(vox.glyphs).every((g) => g === 'cube')).toBe(true);
    expect(vox.fps).toBe(JUICE_FIDELITIES.voxel.fps);
    expect(vox.lightK).toBe(0);
    // the sixth generation's light painted as a pool; the seventh's bloom and more of it thrown
    expect(paint.pool).toBeGreaterThan(0);
    expect(paint.bloom).toBe(0);
    expect(form.bloom).toBeGreaterThan(0);
    expect(form.pool).toBe(0);
    expect(form.lightK).toBeGreaterThan(paint.lightK);
    expect(form.sparks.count).toBeGreaterThan(paint.sparks.count);
    expect(juiceFloor({ ...base, fidelity: 'era' })).toEqual(paint);
  });
  it('lays an explosion\'s pool and bloom, its length covering both', () => {
    const X0 = burst(juiceFloor(base)), Xv = burst(juiceFloor({ ...base, fidelity: 'voxel' })), Xp = burst(juiceFloor({ ...base, fidelity: 'paint' })), Xf = burst(juiceFloor({ ...base, fidelity: 'form' }));
    expect(X0.pool).toBeUndefined();
    expect(X0.bloom).toBeUndefined();
    expect(Xp.pool).toMatchObject({ k: JUICE_FIDELITIES.paint.pool });
    expect(Xp.pool.square).toBeUndefined();
    expect(Xv.pool.square).toBe(true);
    expect(Xv.parts.every((p) => p.glyph === 'cube' || p.glyph === 'star')).toBe(true);
    expect(Xf.bloom.size).toBeGreaterThan(Xf.star.size);
    for (const X of [Xp, Xf]) expect(X.dur).toBeGreaterThanOrEqual(Math.max(X.pool ? X.pool.delay + X.pool.life : 0, X.bloom ? X.bloom.delay + X.bloom.life : 0));
  });
  it('is drawn on the page only where a floor asks: the voxel glyph, the pool, the bloom', () => {
    const plain = eventsChannelScript(puffWorld(base)), vox = eventsChannelScript(puffWorld({ ...base, fidelity: 'voxel' })), form = eventsChannelScript(puffWorld({ ...base, fidelity: 'form' }));
    expect(plain).not.toContain('__mojGlyphs.cube');
    expect(plain).not.toContain('__moFi');
    expect(vox).toContain('__mojGlyphs.cube');
    expect(vox).toContain('I.pool');
    expect(vox).not.toContain('I.bloom');
    expect(form).toContain('I.bloom');
    expect(form).not.toContain('__mojGlyphs.cube');
  });
});

describe('a machine\'s juice at its fidelity', () => {
  it('takes the floor\'s, else the venue\'s drawing, else the read\'s era; the paint written as none', () => {
    const voxelVenue = STADIUM_PRESET_IDS.find((p) => STADIUM_PRESETS[p].look === 'voxel'), animeVenue = STADIUM_PRESET_IDS.find((p) => STADIUM_PRESETS[p].look === 'anime');
    expect(rigFidelity({ venueLook: STADIUM_PRESETS[voxelVenue].look, era: 'gen-7' })).toBe('voxel');
    expect(rigFidelity({ venueLook: STADIUM_PRESETS[animeVenue].look })).toBe('banded');
    expect(rigFidelity({ pole: 'voxel' })).toBe('voxel');
    expect(rigFidelity({ era: 'gen-7' })).toBe('form');
    expect(rigFidelity({ era: 'gen-6' })).toBe('paint');
    expect(rigFidelity({ floor: 'paint', venueLook: 'voxel' })).toBe('paint');
    const rows = [{ id: 'skidSmoke', ...JUICE.skidSmoke }], anchors = [{ kind: 'contact.rear', at: [0, 0, 0], dir: [0, 0, 1] }];
    expect(bakeJuice(rows, anchors, 0.5, { fidelity: 'paint' })).toEqual(bakeJuice(rows, anchors, 0.5));
    expect(bakeJuice(rows, anchors, 0.5, { fidelity: 'form' }).fidelity).toBe('form');
    expect(() => bakeJuice(rows, anchors, 0.5, { fidelity: 'ink' })).toThrow(/fidelity is voxel/);
  });
});

describe('a hero\'s movement juice', () => {
  const figure = { rig: true, figH: 1.8, bones: [{ id: 'root', head: [0, 0, 0] }], parts: [null], clips: {} };
  it('marks a platformer\'s and pinball\'s beats at the body\'s anchors, and none for the other game types', () => {
    for (const f of JUICE_FLAVOR_IDS) expect(heroJuice(f, figure) === null).toBe(!HERO_JUICE_FLAVORS.includes(f));
    for (const f of HERO_JUICE_FLAVORS) {
      const J = heroJuice(f, figure);
      expect(J.hero).toBe(true);
      expect(J.anchors.map((a) => a.kind)).toEqual(['feet', 'body', 'head']);
      expect(J.anchors[1].at[2]).toBeCloseTo(figure.figH * 0.55, 3);
      expect(J.rows.length).toBe(Object.keys(HERO_JUICE[f].rows).length);
      // every row and big effect stands on an anchor the body has (or the screen)
      for (const r of [...J.rows, ...J.fx]) expect(r.at === 'screen' || J.anchors.some((a) => a.kind === r.at)).toBe(true);
    }
    const P = heroJuice('platformer', figure), B = heroJuice('pinball', figure);
    // the platformer marks its jumps and landings; pinball its speed
    expect(P.rows.some((r) => JSON.stringify(r.when).includes('takeoff'))).toBe(true);
    expect(P.rows.some((r) => r.look === 'ring')).toBe(true);
    expect(B.rows.some((r) => r.look === 'trail')).toBe(true);
    expect(B.fx.some((r) => r.look === 'screen')).toBe(true);
    expect(heroJuice('pinball', figure, { fidelity: 'voxel' }).fidelity).toBe('voxel');
  });
  it('reads the platform rule\'s facts on the page only for a hero\'s juice', () => {
    const ents = [{ id: 'hero', rule: { type: 'platform' }, transform: { pos: [0, 0, 1] }, body: { type: 'figure-rig', figure: 'h' } }];
    const juiced = controllableChannelScript(ents, null, { h: { ...figure, juice: heroJuice('platformer', figure) } });
    const plain = controllableChannelScript(ents, null, { h: figure });
    expect(juiced).toContain('function __rjHero');
    expect(plain).not.toContain('__rjHero');
    expect(plain).not.toContain('__rjTexOf');
    expect(controllableChannelScript(ents, null, { h: { ...figure, juice: heroJuice('pinball', figure, { fidelity: 'form' }) } })).toContain('__rjTexOf');
  });
});

describe('a gameworld\'s fidelity', () => {
  it('stamps blocks for a voxel venue, the era otherwise, and the operator\'s word over both', () => {
    const voxelVenue = STADIUM_PRESET_IDS.find((p) => STADIUM_PRESETS[p].look === 'voxel');
    const G = { juice: 'auto', quick: { goal: 'contest', sport: 'tennis', venue: voxelVenue } };
    expect(juiceOfGame(G)).toMatchObject({ fxStyle: { fidelity: 'voxel' }, from: { fidelity: 'venue' } });
    expect(juiceOfGame({ ...G, quick: { goal: 'contest', sport: 'tennis' } })).toMatchObject({ fxStyle: { fidelity: 'era' }, from: { fidelity: 'era' } });
    expect(juiceOfGame({ ...G, juice: { fidelity: 'form' } })).toMatchObject({ fxStyle: { fidelity: 'form' }, from: { fidelity: 'operator' } });
  });
});
