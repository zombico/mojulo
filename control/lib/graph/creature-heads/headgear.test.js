// A kin's headgear (creature-heads/headgear.js): a helmet cut from the head's own field. The laws, on one skull chosen
// from the presets and one card per mass the cards carry: the plate is the skin set out (over the vault there is plate
// just outside the skin, none far off it); it is kept above its rim (none at the jaw); the ears' feet are left clear; a
// card's own masses stand where it puts them (a nasal below the rim on the midline, a horn out to the side over the
// vault); it fits another skull as well, being that skull's surface; a word it does not know is refused by name.
import { describe, it, expect } from 'vitest';
import { KIN_HEADGEAR, KIN_HEADGEAR_IDS, kinHeadgearField } from './headgear.js';
import { relationalCreatureHead, CREATURE_HEADS } from './relational.js';
import { HEAD_V } from '../polygonizer/head-relational.js';

const V = HEAD_V, head = (preset) => relationalCreatureHead({ preset, globes: false, ears: false });
const PLAIN = KIN_HEADGEAR_IDS.find((id) => !KIN_HEADGEAR[id].nasal && !KIN_HEADGEAR[id].horns && !KIN_HEADGEAR[id].spike);
const NASAL = KIN_HEADGEAR_IDS.find((id) => KIN_HEADGEAR[id].nasal), HORNED = KIN_HEADGEAR_IDS.find((id) => KIN_HEADGEAR[id].horns);
// the skin's top on a vertical through (x, y): where the head's field first goes negative coming down
const topAt = (H, x, y) => { for (let z = 1.6; z > 0; z -= 0.002) if (H.field({ x: x * V, y: y * V, z: z * V }) < 0) return z; return null; };
const SKULLS = Object.keys(CREATURE_HEADS);

describe('a kin\'s headgear, cut from its skull\'s field', () => {
  it('is the skin set out over the vault, kept above its rim, the ears\' feet left clear', () => {
    for (const preset of [SKULLS[0], SKULLS.at(-1)]) {
      const H = head(preset), G = kinHeadgearField(H, PLAIN), C = KIN_HEADGEAR[PLAIN], y = -0.1, top = topAt(H, 0, y);
      // (over the crown: plate from the skin out to its pad and thickness, none beyond)
      expect(G.field({ x: 0, y: y * V, z: (top + C.pad + C.thick * 0.5) * V })).toBeLessThan(0);
      expect(G.field({ x: 0, y: y * V, z: (top + C.pad + C.thick + 0.03) * V })).toBeGreaterThan(0);
      // (none at the jaw, under the rim)
      expect(G.field({ x: 0, y: H.points.gn.y, z: H.points.gn.z })).toBeGreaterThan(0);
      // (the ear's foot is clear of it)
      const ear = H.vajras.find((w) => w.name === 'earR');
      expect(G.field({ x: ear.a.x * V, y: ear.a.y * V, z: ear.a.z * V })).toBeGreaterThan(0);
      // (its box holds it, and its middle is inside)
      expect(G.field(G.mid)).toBeLessThan(0);
      expect(G.bounds.max.z).toBeGreaterThan((top + C.pad + C.thick) * V);
    }
  });
  it('a card\'s own masses stand where it puts them: a nasal under the rim on the midline, a horn out over the vault', () => {
    const H = head(SKULLS.at(-1)), plain = kinHeadgearField(H, PLAIN), nasal = kinHeadgearField(H, NASAL), horned = kinHeadgearField(H, HORNED);
    // (the nasal: plate on the midline under the helm's own rim, none there off the midline)
    const eye = H.points.eye, N = KIN_HEADGEAR[NASAL], rim = eye.z + (H.relations.eyeSize + N.front) * V;
    const zs = Array.from({ length: 12 }, (_, i) => rim - (0.05 + i * 0.012) * V).filter((z) => z > rim - N.nasal.length * V), ys = Array.from({ length: 96 }, (_, i) => eye.y + (0.9 - i * 0.01) * V);   // (the face's side of the eye: the rim falls away behind it)
    const hit = (G, x) => zs.some((z) => ys.some((y) => G.field({ x, y, z }) < 0));
    expect(hit(nasal, 0)).toBe(true);
    expect(hit(nasal, N.nasal.width * V * 2)).toBe(false);
    expect(hit(plain, 0)).toBe(false);
    // (the horn: its tip well outside the skull's half breadth, above the crown's side, mirrored)
    const hw = ((H.relations.cephalic * H.relations.craniumLength) / 2) * V, K = KIN_HEADGEAR[HORNED].horns;
    const out = (x) => Array.from({ length: 60 }, (_, i) => H.points.crown.z + (0.5 - i * 0.02) * V).some((z) => [0, -0.05, -0.1].some((dy) => horned.field({ x, y: H.points.crown.y + dy * V, z }) < 0));
    expect(out(hw * K.at + K.len * V * 0.4)).toBe(true);
    expect(out(-(hw * K.at + K.len * V * 0.4))).toBe(true);
    expect(Array.from({ length: 60 }, (_, i) => H.points.crown.z + (0.5 - i * 0.02) * V).some((z) => plain.field({ x: hw * K.at + K.len * V * 0.4, y: H.points.crown.y, z }) < 0)).toBe(false);
  });
  it('refuses a word it does not know, by name; every card reads', () => {
    expect(() => kinHeadgearField(head(SKULLS[0]), 'no-such-helm')).toThrow(/no kin headgear 'no-such-helm'/);
    expect(KIN_HEADGEAR[PLAIN].reads && KIN_HEADGEAR[NASAL].reads && KIN_HEADGEAR[HORNED].reads).toBeTruthy();
  });
});
