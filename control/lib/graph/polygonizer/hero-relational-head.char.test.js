/**
 * the relational head's characterization pin: the head the realistic hero wears (`head: 'relational'`) hashed part by
 * part (the neck it seals to, the cranium, the jaw, the visage, the nose, the eyes, the ears) with the rig's jaw joints,
 * for both poles. A minted head is a compatibility promise; this holds it still.
 *
 * Re-pinning is legitimate ONLY in a commit that says the head's emission changes, with a line here saying why.
 *
 * Pinned 2026-10-20: the face's parts sampled from their own directions (the visage about the mouth, the nose and the
 * eyes about their outlines, the ears on their own fields), approved by the operator's eyes.
 *
 * Re-pin log:
 * - 2026-10-20, the field's normals. Every part's stations carry `normals` (each point's unit gradient of the field it was
 *   sampled from), and the shading takes them (station-loft-shade.js authoredNormals): the handover lines round the
 *   nose and under the eyes, the parts let down under each other by a slope, read at full-figure scale as wrinkles and
 *   a grimace. The points are byte for byte as pinned; only `normals` is new.
 * - 2026-10-21, the female pole (face harmony, approved by the operator's eyes): `RELATION_POLES.female` moves the nose
 *   (shorter, finer, narrower), the eyes (larger), the lips (fuller), the brow, the jaw and the chin (narrower, pointed),
 *   and the cheeks (fuller, the lower cheek bowed out), with `HEAD_TUNES.female` re-solved for it; the eyes' outer rings
 *   close in where they would cast past the face's side (`eyeFrame` room: a wider eye on a narrower face). The male is
 *   byte for byte as pinned.
 * - 2026-10-22, the male pole (face harmony, approved by the operator's eyes): `RELATION_POLES.male`, empty until now,
 *   fills the cheeks and the lower cheek, broadens and rounds the chin (no longer receding) over a wider jaw and a
 *   heavier masseter, shortens the nose with a finer bridge and a wider base, fills the lips and opens the eyes a little,
 *   with `HEAD_TUNES.male` re-solved for it. The female is byte for byte as pinned.
 * - 2026-10-22, the closed mouth's seam (face harmony, the operator: "standardize the depth so it's drawn evenly"): a
 *   closed mouth's lip line is cut to one depth along the lips (`SEAM`, the lips' fronts probed across the mouth) in place
 *   of the lip-line carve, whose depth swung from ~0.6 to ~2.4 mm and left a groove under the surface net's cell in
 *   places (a row of dark notches along the lips). Both poles; the tunes as they were; an open mouth keeps its carve.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const PARTS = ['neck', 'cranium', 'jaw', 'visage', 'nose', 'eyeR', 'eyeL', 'earR', 'earL'];
const PINS = { male: 'e4e630874fc477b4', female: 'a05469bc7935876c' };

describe('the relational head, pinned', () => {
  for (const [cast, pin] of Object.entries(PINS)) it(cast, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational' }) }).recipe;
    const pick = { parts: Object.fromEntries(PARTS.map((k) => [k, r.parts[k]])), jaw: [r.rig.joints.jawHinge, r.rig.joints.jawTip] };
    expect(createHash('sha256').update(JSON.stringify(pick)).digest('hex').slice(0, 16)).toBe(pin);
  });
});
