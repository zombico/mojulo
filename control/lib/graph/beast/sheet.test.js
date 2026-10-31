// The creature-from-sheet flow on the seventh generation: each sheet its own beast. A serpent skull in the library
// (creature-heads/derive.js); a head DESIGNED from a library skull worn on the tiered body (beast/head.js); each sheet's
// head and masses drawn from its kin's by its notes and a seeded variation (egocube/plan.js sheetHead, sheetMass); a coil
// dressed above its hips; a charm seated on a cord two stations deep (station-loft-adorn.js facePoint).
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { planFromSheet, SHEET_HEAD, SHEET_MASS } from '../egocube/plan.js';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { headPlan, headFor } from '../creature-heads/index.js';
import { HEAD_DERIVATIONS } from '../creature-heads/derive.js';
import { validateHead, headFromPlan } from '../polygonizer/station-loft-head.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';

const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const kinWith = (pred) => Object.keys(BEAST_KINS).find((k) => pred(k, BEAST_KINS[k]));
// (by procedure: a coil; a kin whose skull is drawn about the origin, which every move reshapes; one drawn in metres where
// it sits, whose crown no move raises)
const COILED = kinWith((k, c) => c.legs === 'serpent'), HEADED = kinWith((k) => headFor(k) && headPlan(headFor(k).id).units), DRAKE = kinWith((k) => headFor(k) && !headPlan(headFor(k).id).units);
const roll = (ancestry, seed, facets = {}) => rollEgocube({ seed, facets: { ancestry, humanity: 0.3, ...facets } });
const crown = (h) => Math.max(...h.parts.cranium.rows.flatMap(([, , S]) => Object.values(S).map((v) => (Array.isArray(v) ? v[1] : v))));

describe('the serpent skull', () => {
  it('serves the snake-kin, stands whole, flatter than the skull it is drawn from, its pupils slit', () => {
    const D = HEAD_DERIVATIONS.serpent, h = headPlan('serpent'), base = headPlan(D.from);
    expect(headFor(COILED)).toEqual({ id: 'serpent', provisional: false });
    expect(() => validateHead(h)).not.toThrow(); expect(() => headFromPlan(h)).not.toThrow();
    expect(crown(h)).toBeLessThan(crown(base));
    expect(h.eye.pupil).toBe('slit');
    expect((h.ornaments ?? []).some((o) => o.name === 'ear' || o.kind === 'teeth')).toBe(false);
  });
});

describe('a head designed from a library skull', () => {
  const head = { from: headFor(HEADED).id, moves: [{ op: 'muzzle', pivot: 0.02, length: 1.25, width: 0.9 }], eye: { R: 0.018 } };
  it('is the beast\'s head word: validated, worn, its rows the derivation\'s', () => {
    expect(validateHeroSpec({ cast: 'male', beast: { kin: HEADED, head } })).toEqual([]);
    const own = heroPlanOf(mint({ cast: 'male', beast: { kin: HEADED, head } })).heads[0].plan, lib = heroPlanOf(mint({ cast: 'male', beast: { kin: HEADED, head: head.from } })).heads[0].plan;
    expect(own.regions.eye.R).toBe(0.018);
    expect(JSON.stringify(own.parts.cranium.rows)).not.toBe(JSON.stringify(lib.parts.cranium.rows));
  });
  it('refuses a skull the library does not hold, a word it does not know, a move it cannot make', () => {
    expect(validateHeroSpec({ cast: 'male', beast: { kin: HEADED, head: { from: 'cat' } } }).join()).toMatch(/beast\.head\.from/);
    expect(validateHeroSpec({ cast: 'male', beast: { kin: HEADED, head: { ...head, horns: 2 } } }).join()).toMatch(/beast\.head\.horns/);
    expect(validateHeroSpec({ cast: 'male', beast: { kin: HEADED, head: { ...head, moves: [{ op: 'twist' }] } } }).join()).toMatch(/beast\.head\.moves/);
  });
});

describe('each sheet its own beast', () => {
  it('its head drawn from its kin\'s skull within the bands, deterministic, two sheets apart; a skull drawn in place keeps its crown', () => {
    const kin = HEADED, a = planFromSheet(roll(kin, 1)).create.spec.beast.head, b = planFromSheet(roll(kin, 2)).create.spec.beast.head;
    expect(a.from).toBe(headFor(kin).id);
    expect(planFromSheet(roll(kin, 1)).create.spec.beast.head).toEqual(a);
    expect(JSON.stringify(a.moves)).not.toBe(JSON.stringify(b.moves));
    const [len, skull, muzzle] = a.moves, B = SHEET_HEAD;
    expect(Math.abs(len.k - 1)).toBeLessThanOrEqual(B.length + 1e-9);
    expect(Math.abs(skull.width - 1)).toBeLessThanOrEqual(B.width + B.bias + 1e-9);
    expect(Math.abs(muzzle.length - 1)).toBeLessThanOrEqual(B.muzzle + B.bias + 1e-9);
    expect(validateHeroSpec(planFromSheet(roll(kin, 1)).create.spec)).toEqual([]);
    // (the dragon's skull is drawn in metres where it sits: no move of its crown's height)
    expect(planFromSheet(roll(DRAKE, 1)).create.spec.beast.head.moves[1].height).toBeUndefined();
  });

  it('its masses its kin\'s leaned by its silhouette word and varied within a band; the door takes and bounds them', () => {
    const kin = kinWith((k, c) => c.hump > 0), K = BEAST_KINS[kin], s = roll(kin, 3), b = planFromSheet(s).create.spec.beast;
    const word = Object.values(s.derives).flat().map((d) => /^silhouette = (\S+)/.exec(d)?.[1]).find(Boolean), S = SHEET_MASS.silhouettes[word] ?? {};
    for (const [k, v] of Object.entries(b.mass)) expect(Math.abs(v / ((K.mass[k] ?? 1) * (S[k] ?? 1)) - 1), k).toBeLessThanOrEqual(SHEET_MASS.band + 0.002);
    expect(JSON.stringify(planFromSheet(roll(kin, 4)).create.spec.beast.mass)).not.toBe(JSON.stringify(b.mass));
    expect(validateHeroSpec({ cast: 'male', beast: { kin, mass: { trunk: 3 } } }).join()).toMatch(/beast\.mass\.trunk/);
    expect(validateHeroSpec({ cast: 'male', beast: { kin, mass: { tail: 1 } } }).join()).toMatch(/beast\.mass\.tail/);
    expect(validateHeroSpec({ cast: 'male', beast: { kin, hump: 1.5 } }).join()).toMatch(/beast\.hump/);
    // (the designed masses reach the body: a heavier trunk is a wider one)
    const w = (m) => { const t = heroPlanOf(mint({ cast: 'male', beast: { kin, mass: { trunk: m } } })).segments.find((x) => x.name === 'torso').stations[2].r; return Array.isArray(t) ? t[0] : t; };
    expect(w(1.4)).toBeGreaterThan(w(1.0));
  });

  it('a coil is dressed above its hips: a top to the waist, no bottom, no coat, no feet, no piece on a leg; the ledger says so', () => {
    const P = planFromSheet(roll(COILED, 5, { pole: 'female' }), { dress: 'designed' }), O = P.create.spec.outfit, L = O.style.language;
    expect(L.bottom).toBeUndefined(); expect(L.outer).toBeUndefined(); expect(L.feet).toBe('none');
    if (L.top) expect(L.top.hem).toBe('waist');
    expect(O.pieces.some((p) => ['anklets', 'thighPouch'].includes(p.kind))).toBe(false);
    expect(P.ledger.filter((r) => r.channel === 'dress' && r.at).every((r) => /above the coil/.test(r.at))).toBe(true);
    expect(() => expandLayeredManifest({ kind: 'layered', hero: mint(P.create.spec) })).not.toThrow();
  }, 60_000);

  it('a charm seats on its two-station cord: a designed outfit with charms dresses a person and a beast-kin', () => {
    const P = planFromSheet(roll('feline', 9, { humanity: 0.35 }), { dress: 'designed' }), spec = P.create.spec;
    const outfit = { ...spec.outfit, pieces: [{ kind: 'charms', family: 'found', charm: 'both' }] }, { beast: _b, ...person } = spec;
    expect(() => expandLayeredManifest({ kind: 'layered', hero: mint({ ...spec, outfit }) })).not.toThrow();
    expect(() => expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultWalk(withDefaultForm({ ...person, outfit }))) })).not.toThrow();
  }, 60_000);
});
