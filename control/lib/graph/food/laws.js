/**
 * THE FOOD'S LAWS: what a card's food is held to (advice, never a refusal: docs/bicycles.md). Measured on the looks
 * (food/derive.js), never on a picture; whether it reads as food is the eyes gate, the operator's.
 *
 *   drawn     every thing the card handles has a look with faces
 *   apart     no two of a card's things look alike: each differs from every other in its form (or arrangement), its
 *             vessel or its colour (a dish: any of its parts')
 *   states    a thing made from one ingredient looks unlike that ingredient as it comes (a fillet is not a fish)
 *   fits      each look at glyph scale stands inside a unit box (1.1 across, 1 high), its base on the ground
 *
 *   foodLaws(card) → [{ law, holds, says }]
 */
import { foodOf, lookFaces, bounds } from './derive.js';

// (a dish by its arrangement, its vessel and every part's colour; a thing by its form, its vessel and its first colour)
const sig = (L) => [L.kind === 'dish' ? `dish:${L.arrangement}${L.browned ? ':browned' : ''}` : L.form, L.vessel ?? '', ...(L.kind === 'dish' ? L.colours : (L.colours ?? []).slice(0, 1))].join('|');

export function foodLaws(card) {
  const F = foodOf(card), items = Object.keys(F), laws = [];
  const faces = Object.fromEntries(items.map((i) => [i, lookFaces(F[i])]));
  const blank = items.filter((i) => !faces[i].length);
  laws.push({ law: 'drawn', holds: !blank.length, says: blank.length ? `no look: ${blank.join(', ')}` : `${items.length} things drawn` });
  const seen = {}, alike = [];
  for (const i of items) { const s = sig(F[i]); if (seen[s]) alike.push(`${seen[s]} and ${i}`); else seen[s] = i; }
  laws.push({ law: 'apart', holds: !alike.length, says: alike.length ? `look alike: ${alike.join('; ')}` : 'every thing looks unlike every other' });
  const same = items.filter((i) => F[i].kind === 'ingredient' && F[i].state !== 'whole').filter((i) => {
    const w = Object.values(F).find((L) => L.kind === 'ingredient' && L.ingredient === F[i].ingredient && L.state === 'whole');
    return w && sig(w) === sig(F[i]);
  });
  laws.push({ law: 'states', holds: !same.length, says: same.length ? `made, and still looking as it came: ${same.join(', ')}` : 'what is made looks unlike what it was made from' });
  const out = items.filter((i) => { const [lo, hi] = bounds(faces[i]); return lo[2] < -1e-6 || hi[2] > 1 || Math.max(hi[0] - lo[0], hi[1] - lo[1]) > 1.1; });
  laws.push({ law: 'fits', holds: !out.length, says: out.length ? `outside a unit box: ${out.join(', ')}` : 'each stands in a unit box, its base on the ground' });
  return laws;
}
