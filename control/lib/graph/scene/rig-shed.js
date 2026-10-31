/**
 * rig-shed — what a foe SHEDS when a mode of it is defeated (worlds/controllable/vanish.js `body.modes`): the triangles a
 * mode's figure carries that the next mode's lacks, bone by bone (the armour off an armoured skeleton, the shell off a
 * shelled one). Both figures are packed rigs on the same stick figure (polygonizer/station-loft-rig.js packLayeredRig),
 * their bones matched by name, so a piece shed rides the bone it was on and falls from where it was worn.
 *
 *   shedParts(from, into)   → { [bone index in from]: { pos, col } }: each bone's triangles in `from` found nowhere on
 *                             the same bone in `into` (their corners compared to a tenth of a millimetre), packed as the
 *                             pack writes a part; a bone with nothing to shed is left out
 *
 * Pure: the same two figures give the same bytes.
 */
import { b64f32 } from '../figures/rig-bake.js';

const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const u8 = (s) => { const b = Buffer.from(s, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); };

export function shedParts(from, into) {
  const at = new Map(into.bones.map((b, i) => [b.id, i])), out = {};
  const key = (P, t) => { const k = []; for (let j = 0; j < 9; j++) k.push(Math.round(P[t * 9 + j] * 1e4)); return k.join(','); };
  from.parts.forEach((part, bi) => {
    if (!part) return;
    const j = at.get(from.bones[bi].id), other = j === undefined ? null : into.parts[j];
    const have = new Set();
    if (other) { const Q = f32(other.pos); for (let t = 0; t < Q.length / 9; t++) have.add(key(Q, t)); }
    const P = f32(part.pos), C = u8(part.col), pos = [], col = [];
    for (let t = 0; t < P.length / 9; t++) {
      if (have.has(key(P, t))) continue;
      for (let k = 0; k < 9; k++) pos.push(P[t * 9 + k]);
      for (let k = 0; k < 9; k++) col.push(C[t * 9 + k]);
    }
    if (pos.length) out[bi] = { pos: b64f32(pos), col: Buffer.from(Uint8Array.from(col).buffer).toString('base64') };
  });
  return out;
}
