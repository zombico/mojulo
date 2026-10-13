import { describe, it, expect } from 'vitest';
import { rollEgocube, readEgocube, archetypeReading, FAULTS, PRIORS, SPEC_KEYS } from './egocube.js';
import { CHANNELS, CHANNEL_IDS, DIALS, readDerive } from './channels.js';
import { AGES, BUILDS, ROLES, ARCHETYPES, ARCHETYPE_IDS, QUADRANTS, MOTIVES, ORDERS } from './facets.js';
import { LEXICON, readBrief } from './lexicon.js';
import { WESTERN_CHANNELS } from '../polygonizer/humanoid-head.js';
import { ANIME_SCULPT_KEYS } from '../polygonizer/anime-sculpt.js';
import { ANIME_FACE_MOVES, ANIME_FACE_KEYS } from '../polygonizer/anime-head.js';
import { FACE_KEYS } from '../polygonizer/humanoid-head.js';
import { HAIR_KEYS } from '../polygonizer/humanoid-hair.js';
import { TUNE_KEYS, HERO_CASTS } from '../polygonizer/hero-form.js';
import { GESTURE_WORDS } from '../polygonizer/hero-gesture.js';
import { CAST_PRESETS } from '../polygonizer/figure-cast.js';
import { AXES } from '../gameworld/hero-vibe.js';
import { ARMOR_DIALS } from '../armor/principles.js';
import { OUTFIT_DIALS } from '../outfit/principles.js';
import { POLES } from './facets.js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HUMAN_ANCESTRIES, HUMAN_IDS, LINEAGES, MST, DOOR_H, readLineage } from './ancestry.js';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

/** Every derive string anywhere in the facet tables, with where it sits. */
function everyDerive() {
  const out = [];
  const walk = (at, d) => { for (const [ch, list] of Object.entries(d || {})) for (const x of list) out.push({ at: `${at}.${ch}`, ch, x }); };
  for (const [k, v] of Object.entries(AGES)) walk(`age.${k}`, v.derives);
  for (const [k, v] of Object.entries(BUILDS)) walk(`build.${k}`, v.derives);
  for (const [k, v] of Object.entries(ROLES)) walk(`role.${k}`, v.derives);
  for (const [k, v] of Object.entries(ARCHETYPES)) { walk(`${k}.light`, v.light.derives); walk(`${k}.shadow`, v.shadow.derives); }
  MOTIVES.forEach((m, i) => walk(`motive.${i}`, m.derives));
  for (const [k, v] of Object.entries(ORDERS)) walk(`order.${k}`, v.derives);
  for (const [k, v] of Object.entries(HUMAN_ANCESTRIES)) walk(`ancestry.${k}`, v.derives);
  for (const [k, v] of Object.entries(LINEAGES)) v.cues.forEach((c, i) => walk(`lineage.${k}.${i}`, { [c.ch]: c.derives || [] }));
  return out;
}

describe('the dial register', () => {
  it('names only keys the live tables have', () => {
    const live = {
      expression: WESTERN_CHANNELS, sculpt: ANIME_SCULPT_KEYS, axes: Object.keys(AXES), tune: TUNE_KEYS,
      gesture: GESTURE_WORDS, cast: Object.keys(CAST_PRESETS), trait: Object.keys(ANIME_FACE_MOVES), hair: HAIR_KEYS,
      armor: Object.keys(ARMOR_DIALS), outfit: Object.keys(OUTFIT_DIALS), face: [...ANIME_FACE_KEYS, ...FACE_KEYS],
    };
    for (const [family, keys] of Object.entries(live)) for (const k of DIALS[family].keys) expect(keys, `${family}.${k}`).toContain(k);
    expect(POLES).toEqual(Object.keys(HERO_CASTS));
    const heads = readdirSync(`${REPO}control/lib/graph/creature-heads/heads`).map((f) => f.replace('.head.json', ''));
    expect(DIALS.head.keys.sort()).toEqual(heads.sort());
    const catalyst = readFileSync(`${REPO}control/lib/mcp/catalysts/creature-from-plan.md`, 'utf8');
    for (const p of DIALS.pass.keys) expect(catalyst, `pass ${p}`).toMatch(new RegExp(`^\\| \\d [a-z ]*${p} \\|`, 'mi'));   // '6 Grown patches'
    const wings = readFileSync(`${REPO}docs/examples/wings/README.md`, 'utf8');
    for (const w of DIALS.wings.keys) expect(wings).toMatch(new RegExp(w, 'i'));
    for (const b of Object.keys(BUILDS)) expect(Object.keys(CAST_PRESETS)).toContain(b);
  });
  it('reads every derive in the tables, on a channel the table means', () => {
    for (const { at, ch, x } of everyDerive()) {
      expect(CHANNEL_IDS, at).toContain(ch);
      expect(() => readDerive(x), `${at}: ${x}`).not.toThrow();
    }
  });
  it('refuses a malformed or unknown derive by name', () => {
    expect(() => readDerive('expression.mouthCorner')).toThrow(/family.key/);
    expect(() => readDerive('aura.glow +')).toThrow(/unknown dial family 'aura'/);
    expect(() => readDerive('cast = giant')).toThrow(/unknown cast 'giant'.*brute/);
    expect(() => readDerive('gesture.guard +')).toThrow(/takes a word/);
  });
});

describe('the facet tables', () => {
  it('give every archetype a light and a shadow on the channels that carry a person', () => {
    expect(ARCHETYPE_IDS.length % QUADRANTS.length).toBe(0);
    for (const [id, a] of Object.entries(ARCHETYPES)) {
      expect(QUADRANTS, id).toContain(a.quadrant);
      expect(a.shadow.name, id).toMatch(/^the /);
      for (const side of ['light', 'shadow']) for (const ch of ['rest', 'eyes', 'stance', 'silhouette', 'dress', 'palette']) {
        expect(a[side].notes[ch], `${id}.${side}.${ch}`).toBeTruthy();
      }
    }
  });
  it('keeps the archetypes in wheel order: three to a quadrant, the quadrants in turn', () => {
    const per = ARCHETYPE_IDS.length / QUADRANTS.length;
    ARCHETYPE_IDS.forEach((id, i) => expect(ARCHETYPES[id].quadrant, id).toBe(QUADRANTS[Math.floor(i / per)]));
  });
  it('writes notes only to known channels, and lexicon words only known facet values', () => {
    for (const [phrase, facets] of Object.entries(LEXICON)) expect(() => readEgocube(facets), phrase).not.toThrow();
    for (const ch of Object.keys(CHANNELS)) expect(['born', 'lived']).toContain(CHANNELS[ch].life);
  });
});

describe('readEgocube', () => {
  it('refuses unknown facets and values, naming the known ones', () => {
    expect(() => readEgocube({ class: 'paladin' })).toThrow(/unknown facet 'class'.*archetype/);
    expect(() => readEgocube({ archetype: 'paladin' })).toThrow(/unknown archetype 'paladin'.*ruler/);
    expect(() => readEgocube({ motivation: 2 })).toThrow(/0 … 1/);
    expect(() => readEgocube({ age: 'adult', role: 'caster', motivation: 0.4 })).not.toThrow();
  });
});

describe('readBrief', () => {
  it('reads the longest phrase first, a later word winning, and returns what it could not read', () => {
    expect(readBrief('a dark knight').facets).toMatchObject({ role: 'frontline', archetype: 'hero', motivation: 0.6 });
    expect(readBrief('knight').facets.motivation).toBeUndefined();
    const r = readBrief('an old greedy wizard with a crooked staff');
    expect(r.facets).toMatchObject({ age: 'elder', motivation: 0.85, role: 'caster', archetype: 'sage' });
    expect(r.read).toEqual(['old', 'greedy', 'wizard']);
    expect(r.unread).toEqual(['crooked', 'staff']);
  });
});

describe('rollEgocube', () => {
  it('rolls the same sheet for the same arguments, byte for byte, and another for another seed', () => {
    const a = JSON.stringify(rollEgocube({ brief: 'rogue', seed: 4 }));
    expect(JSON.stringify(rollEgocube({ brief: 'rogue', seed: 4 }))).toBe(a);
    expect(JSON.stringify(rollEgocube({ brief: 'rogue', seed: 5 }))).not.toBe(a);
    expect(JSON.stringify(rollEgocube({ brief: 'rogue', seed: 4, path: 'hero/rival' }))).not.toBe(a);
  });
  it('decides a facet by the explicit ask, then the brief, then the seed; fixing one never moves another', () => {
    const blind = rollEgocube({ seed: 9 });
    const fixed = rollEgocube({ seed: 9, facets: { role: 'caster' } });
    expect(fixed.facets.role).toBe('caster');
    for (const k of SPEC_KEYS.filter((k) => k !== 'role')) expect(fixed.facets[k], k).toBe(blind.facets[k]);
    const both = rollEgocube({ seed: 9, brief: 'paladin', facets: { motivation: 0.7 } });
    expect(both.facets).toMatchObject({ role: 'frontline', archetype: 'hero', motivation: 0.7, order: 0.15 });
    expect(both.given).toEqual(['role', 'archetype', 'motivation', 'order']);
  });
  it('rolls only valid Egocubes, over many seeds, every value reachable', () => {
    const seen = { age: new Set(), build: new Set(), role: new Set(), archetype: new Set(), ancestry: new Set() };
    for (let seed = 1; seed <= 400; seed++) {
      const s = rollEgocube({ seed });
      expect(() => readEgocube(s.facets)).not.toThrow();
      expect(s.faults).toEqual([]);
      for (const k of Object.keys(seen)) seen[k].add(s.facets[k]);
    }
    for (const k of Object.keys(seen)) expect([...seen[k]].sort(), k).toEqual(Object.keys(PRIORS[k]).sort());
  });
  it('draws a fault again, and keeps one the operator asked for, marked held', () => {
    const fault = FAULTS.find((x) => x.id === 'child-shadow');
    let redrawn = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = rollEgocube({ seed, facets: { age: 'child' } });
      expect(fault.when(s.facets), `seed ${seed}`).toBe(false);
      if (s.attempt > 0) redrawn++;
    }
    expect(redrawn).toBeGreaterThan(0);
    const held = rollEgocube({ brief: 'child necromancer' });
    expect(held.facets).toMatchObject({ age: 'child', motivation: 0.85 });
    expect(held.faults).toEqual([expect.objectContaining({ id: 'child-shadow', held: true })]);
  });
});

describe('the blend and the life', () => {
  it('reads the archetype light, turning, then shadow as motivation rises', () => {
    expect(archetypeReading(0.1).reads).toBe('light');
    expect(archetypeReading(0.6).reads).toBe('turning');
    expect(archetypeReading(0.95).reads).toBe('shadow');
    const from = (m) => rollEgocube({ facets: { archetype: 'hero', motivation: m } }).notes.rest.map((n) => n.from);
    expect(from(0.1)).toContain('archetype.hero');
    expect(from(0.1)).not.toContain('archetype.hero/shadow');
    expect(from(0.6)).toEqual(expect.arrayContaining(['archetype.hero', 'archetype.hero/shadow']));
    expect(from(0.95)).not.toContain('archetype.hero');
  });
  it('gives the dark knight the hero\'s shadow first without a dark-knight entry', () => {
    const s = rollEgocube({ brief: 'dark knight' });
    expect(s.reading).toMatchObject({ archetype: 'hero', shadow: 'the bully', reads: 'turning' });
    expect(s.notes.rest[0].from).toBe('archetype.hero/shadow');
  });
  it('keeps a child\'s face undrawn and draws an elder\'s deep', () => {
    const child = rollEgocube({ facets: { age: 'child', archetype: 'ruler', motivation: 0.3 } });
    for (const ch of ['rest', 'eyes', 'wear']) for (const n of child.notes[ch] || []) expect(n.from, ch).toBe('age.child');
    expect(child.derives.frame).toContain('cast = child');
    const elder = rollEgocube({ facets: { age: 'elder', archetype: 'ruler', motivation: 0.3 } });
    expect(elder.notes.rest.map((n) => n.from)).toContain('archetype.ruler');
    expect(elder.notes.wear.map((n) => n.from)).toContain('age.elder');
    expect(elder.unread.channels).toContain('wear');
  });
  it('names each dial once a sheet, the higher source winning', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = rollEgocube({ seed });
      const keys = Object.values(s.derives).flat().map((d) => { const r = readDerive(d); return r.dir ? `${r.family}.${r.key}` : r.family; });
      expect(new Set(keys).size, `seed ${seed}`).toBe(keys.length);
    }
  });
});

describe('ancestry: human', () => {
  it('rolls a tone inside the ancestry\'s span, and writes colouring and hair, never structure', () => {
    for (const id of HUMAN_IDS) {
      const [lo, hi] = HUMAN_ANCESTRIES[id].tones;
      for (let seed = 1; seed <= 20; seed++) {
        const s = rollEgocube({ seed, facets: { ancestry: id } });
        const tone = MST.indexOf(s.ancestry.colours.Skin) + 1;
        expect(tone, `${id} seed ${seed}`).toBeGreaterThanOrEqual(lo);
        expect(tone, `${id} seed ${seed}`).toBeLessThanOrEqual(hi);
        expect(s.ancestry).toMatchObject({ kind: 'human', door: 'hero' });
        for (const n of s.notes.structure || []) expect(n.from, id).not.toMatch(/^ancestry/);
        expect(s.unread.channels).not.toContain('colouring');
      }
    }
  });
  it('names the hair it cannot draw yet as a gap', () => {
    const coily = Array.from({ length: 30 }, (_, i) => rollEgocube({ seed: i + 1, facets: { ancestry: 'african' } })).find((s) => s.notes.hair.some((n) => n.line === 'coily hair'));
    expect(coily.gaps.join(' ')).toMatch(/no coily texture/);
  });
  it('rolls only humans blind; a people is asked for', () => {
    for (let seed = 1; seed <= 200; seed++) expect(HUMAN_IDS).toContain(rollEgocube({ seed }).facets.ancestry);
  });
  it('never moves another facet when the ancestry is fixed', () => {
    for (const seed of [3, 8, 13]) {
      const blind = rollEgocube({ seed }).facets, fixed = rollEgocube({ seed, facets: { ancestry: 'draconic' } }).facets;
      for (const k of SPEC_KEYS.filter((k) => !['ancestry', 'humanity'].includes(k))) expect(fixed[k], k).toBe(blind[k]);
    }
  });
});

describe('ancestry: lineages, from the creature loop', () => {
  it('reads every built lineage', () => {
    for (const [id, lin] of Object.entries(LINEAGES)) expect(() => readLineage(id, lin), id).not.toThrow();
  });
  it('places humanity in the lineage\'s band and leaves the hero door below it', () => {
    for (const [id, lin] of Object.entries(LINEAGES)) for (let seed = 1; seed <= 15; seed++) {
      const s = rollEgocube({ seed, facets: { ancestry: id } });
      expect(s.facets.humanity, id).toBeGreaterThanOrEqual(lin.humanity[0]);
      expect(s.facets.humanity, id).toBeLessThanOrEqual(lin.humanity[1]);
      if (s.facets.humanity < DOOR_H) expect(s.ancestry.door, `${id} at ${s.facets.humanity}`).toBe('creature');
    }
  });
  it('shows the deepest cue of a slot only: the long snout replaces the short', () => {
    const deep = rollEgocube({ facets: { ancestry: 'draconic', humanity: 0.2 } });
    const lines = deep.notes.structure.map((n) => n.line).join(' | ');
    expect(lines).toMatch(/long dragon snout/);
    expect(lines).not.toMatch(/short snout/);
    expect(deep.derives.structure).toContain('head = dragon');
    expect(deep.derives.frame).toContain('legs = digitigrade');
    const near = rollEgocube({ facets: { ancestry: 'draconic', humanity: 0.9 } });
    expect(near.ancestry.door).toBe('hero');
    expect(near.notes.structure?.some((n) => /snout/.test(n.line))).toBeFalsy();
    expect(near.gaps.join(' ')).toMatch(/hero door/);
  });
  it('varies the same people over seeds: colour, picks and humanity', () => {
    const sheets = Array.from({ length: 12 }, (_, i) => rollEgocube({ seed: i + 1, facets: { ancestry: 'draconic' } }));
    expect(new Set(sheets.map((s) => s.ancestry.colours.Skin)).size).toBeGreaterThan(2);
    expect(new Set(sheets.map((s) => s.notes.ornament?.[0]?.line)).size).toBeGreaterThan(2);
    expect(new Set(sheets.map((s) => s.facets.humanity)).size).toBeGreaterThan(5);
  });
  it('keeps a lineage\'s born cues on a child, whose life is not yet drawn', () => {
    const s = rollEgocube({ facets: { ancestry: 'draconic', age: 'child' } });
    expect(s.notes.eyes.map((n) => n.from)).toEqual(['ancestry.draconic']);
  });
  it('rolls a people established once, and refuses a malformed one by its field', () => {
    const mothfolk = {
      reads: 'mothfolk', humanity: [0.4, 0.7], cover: { dusk: '#6a5a4a', ivory: '#e2dccb' },
      cues: [
        { at: 1, ch: 'eyes', line: 'large dark eyes, no whites' },
        { at: 0.8, ch: 'ornament', line: 'antennae {pick}', pick: ['feathered', 'long and thin'], derives: ['pass = ornaments'] },
        { at: 0.6, ch: 'silhouette', line: 'dusty wings folded like a cloak', derives: ['wings = membrane'] },
      ],
    };
    const runs = Array.from({ length: 6 }, (_, i) => rollEgocube({ seed: i + 1, facets: { ancestry: 'mothfolk' }, lineages: { mothfolk } }));
    for (const s of runs) expect(s.notes.eyes.map((n) => n.line)).toContain('large dark eyes, no whites');
    expect(new Set(runs.map((s) => s.ancestry.colours.Skin)).size).toBe(2);
    expect(() => rollEgocube({ facets: { ancestry: 'mothfolk' }, lineages: { mothfolk: { ...mothfolk, cues: [{ at: 1, ch: 'aura', line: 'x' }] } } })).toThrow(/unknown channel 'aura'/);
    expect(() => rollEgocube({ facets: { ancestry: 'mothfolk' } })).toThrow(/unknown ancestry 'mothfolk'/);
  });
  it('draws a build the people does not have again, and keeps one asked for', () => {
    for (let seed = 1; seed <= 30; seed++) expect(LINEAGES.sylvan.builds, `seed ${seed}`).toContain(rollEgocube({ seed, facets: { ancestry: 'sylvan' } }).facets.build);
    const stout = rollEgocube({ brief: 'a stout elf' });
    expect(stout.facets.build).toBe('stout');
    expect(stout.faults).toEqual([expect.objectContaining({ id: 'lineage-build', held: true })]);
  });
  it('reads the dragon warrior as a draconic frontline hero', () => {
    expect(readBrief('a dragon warrior').facets).toMatchObject({ ancestry: 'draconic', role: 'frontline', archetype: 'hero' });
  });
});

describe('the body pole', () => {
  it('reads past childhood, never on a child', () => {
    const child = rollEgocube({ facets: { age: 'child', pole: 'female' } }), youth = rollEgocube({ facets: { age: 'youth', pole: 'female' } });
    expect(Object.values(child.notes).flat().some((n) => n.from.startsWith('pole.'))).toBe(false);
    expect(youth.notes.silhouette.some((n) => n.from === 'pole.female' && /waist/.test(n.line))).toBe(true);
    expect(youth.notes.dress.some((n) => /padding/.test(n.line))).toBe(true);
    const man = rollEgocube({ facets: { age: 'adult', pole: 'male' } });
    expect(man.notes.frame.some((n) => n.from === 'pole.male')).toBe(true);
  });
});
