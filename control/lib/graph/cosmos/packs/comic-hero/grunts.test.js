// The grunts: a faction is a style pack of the door's words; a squad is cast at a fixed share of women, seeded, in one
// crew's colours. One faction per dress path, chosen from the catalogue in code (a suit cut by pole, a head on the
// tiered body, gear in two slots); every faction, kind and pole on both bodies: comic-hero.deep.test.js.
import { describe, it, expect } from 'vitest';
import { GRUNT_STYLES, GRUNT_STYLE_IDS, GRUNT_RATIO, gruntOrders, squadOrders } from './grunts.js';
import { LOOKS } from './looks.js';
import { bodyOf } from './characters.js';
import { validateHeroSpec } from '../../../../mcp/tools/layered.js';

const byBody = Object.fromEntries(Object.keys(LOOKS).map((id) => [bodyOf(id), id]));
const valid = (o) => { const { vibe: _v, ...f } = o.mint.args.spec; return validateHeroSpec(f); };
const kinds = (s) => Object.values(GRUNT_STYLES[s].kinds);
// (a faction whose suits are cut by pole, one that wears heads, one with gear in two slots)
const SUITED = GRUNT_STYLE_IDS.find((s) => kinds(s).some((K) => K.dress('male').style !== K.dress('female').style));
const HEADED = GRUNT_STYLE_IDS.find((s) => kinds(s).every((K) => K.heads?.length && K.heads.every(Boolean)));
const TWO_SLOTS = GRUNT_STYLE_IDS.find((s) => kinds(s).some((K) => K.items.some((l) => l.length === 2)));

describe('comic hero pack: grunts', () => {
  it('casts a squad at the share of women asked, 0.3 by default, the same squad for the same seed', () => {
    expect(GRUNT_RATIO).toBe(0.3);
    for (const count of [10, 7, 3]) {
      const q = squadOrders(SUITED, byBody.tiered, { count });
      expect(q).toHaveLength(count);
      expect(q.filter((o) => o.grunt.pole === 'female')).toHaveLength(Math.round(0.3 * count));
    }
    expect(squadOrders(SUITED, byBody.tiered, { count: 6, ratio: 0.5 }).filter((o) => o.grunt.pole === 'female')).toHaveLength(3);
    const a = squadOrders(SUITED, byBody.tiered, { count: 6, seed: 4 }), b = squadOrders(SUITED, byBody.tiered, { count: 6, seed: 4 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(squadOrders(SUITED, byBody.tiered, { count: 6, seed: 5 }))).not.toBe(JSON.stringify(a));
  });
  it('naming one choice never moves the others: another pole keeps the kind, the build and the gear', () => {
    const o = gruntOrders(TWO_SLOTS, byBody.tiered, { seed: 3, index: 2 });
    const other = gruntOrders(TWO_SLOTS, byBody.tiered, { seed: 3, index: 2, pole: o.grunt.pole === 'male' ? 'female' : 'male' });
    expect([other.grunt.kind, other.grunt.build, other.grunt.age, other.grunt.items]).toEqual([o.grunt.kind, o.grunt.build, o.grunt.age, o.grunt.items]);
  });
  it('dresses a woman in her own cut where the faction cuts one, and opens her guard', () => {
    const [kind] = Object.entries(GRUNT_STYLES[SUITED].kinds).find(([, K]) => K.dress('male').style !== K.dress('female').style);
    const m = gruntOrders(SUITED, byBody.tiered, { kind, pole: 'male' }), f = gruntOrders(SUITED, byBody.tiered, { kind, pole: 'female' });
    expect(f.mint.args.spec.outfit.style).not.toBe(m.mint.args.spec.outfit.style);
    expect(f.mint.args.spec.cast).toBe('female');
    const guarded = Array.from({ length: 12 }, (_, i) => gruntOrders(SUITED, byBody.tiered, { seed: i + 1, pole: 'female' })).find((o) => Array.isArray(o.mint.args.spec.gesture));
    if (guarded) expect(guarded.mint.args.spec.gesture).toEqual(['guard', { elbowR: 130 }]);
  });
  it('a squad wears its crew\'s colours, each grunt varied within them, over any head it wears', () => {
    const S = GRUNT_STYLES[HEADED], [cw, CW] = Object.entries(S.colourways)[1];
    const q = squadOrders(HEADED, byBody.tiered, { count: 5, colourway: cw });
    for (const o of q) {
      for (const [g, hex] of Object.entries(CW.palette)) expect(o.mint.args.spec.palette[g], `${o.grunt.kind} ${g}`).toBe(hex);
      for (const [g, list] of Object.entries(CW.vary || {})) expect(list).toContain(o.mint.args.spec.palette[g]);
      expect(o.grunt.head).toBeTruthy();
    }
  });
  it('wears its heads on the tiered body only; every order validates on both bodies; gear lands in its slots', () => {
    for (const s of [SUITED, HEADED, TWO_SLOTS]) for (const body of ['tiered', 'realistic']) {
      for (const o of squadOrders(s, byBody[body], { count: 4, seed: 2 })) {
        expect(valid(o), `${s} ${o.grunt.kind} ${body}`).toEqual([]);
        if (body === 'realistic') { expect(o.grunt.head).toBeNull(); expect(o.mint.args.spec.form).toBe('realistic'); }
        expect(Object.keys(o.mint.args.spec.gear || {})).toHaveLength(o.grunt.items.length);
      }
    }
  });
  it('refuses what it does not know by name', () => {
    expect(() => gruntOrders('pirates', byBody.tiered)).toThrow(/no grunt style 'pirates' \(known: streetGang/);
    expect(() => gruntOrders(SUITED, byBody.tiered, { kind: 'admiral' })).toThrow(/has no kind 'admiral' \(known:/);
    expect(() => gruntOrders(SUITED, byBody.tiered, { colourway: 'plaid' })).toThrow(/has no colourway 'plaid' \(known:/);
    expect(() => squadOrders(SUITED, byBody.tiered, { count: 0 })).toThrow(/1 to 64/);
  });
});
