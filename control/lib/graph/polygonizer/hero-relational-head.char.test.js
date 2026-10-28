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
 * - 2026-10-23, the cranium under the eyes (unified character, the operator: "male eyes disappeared"): under the visage
 *   the cranium is let down from the deeper of the bare head and the face itself, so a deep-set eye's socket no longer
 *   leaves the cranium standing in front of the globe (a rolled face's eye read shut, a pale sheet over it). Both poles.
 * - 2026-10-23, the eye's surround (unified character, the operator: the eye area's spikes, before the face rig): within
 *   an eye's footprint the visage and the nose are held `eyeSink` behind the globe's front as the eye's own look sees it
 *   (`eyeGlobeIn`), and the cranium let down `eyeDeflate` more about each globe: the lower lid is a ledge over the globe,
 *   and faces bridging its front and the globe beside it cut in front of the eye as spikes. Both poles.
 * - 2026-10-23, the ONE SKIN (realistic laws 2, the operator: "the face in 3D has become confused"): a hero minted now
 *   wears the head's field netted whole (hero-one-skin.js) in place of the pieces; the pieces stay pinned under laws 1,
 *   byte for byte, and the one skin is pinned beside them.
 * - 2026-10-24, the one skin over rolled faces (hero-one-skin.deep.test.js): a rim the net's pinches left touching itself
 *   is split into simple loops and fanned shut (holes at the nostrils, the canthi and the sockets), crossings on the lips'
 *   line within a weld are one point, and no collapse leaves a face flat. The one skin's two poles; the pieces as pinned.
 * - 2026-10-24, the lids' crease (the operator: the blink's fold): the skin netted at 1 mm (the upper lid's fold is
 *   thinner than 1.5 mm and pinched ragged), the rim's untangle read only about the seam ring (it had smoothed the
 *   nostrils and the sockets). The one skin's two poles; the pieces as pinned.
 * - 2026-10-24, the cervical neck (realistic laws 3, the operator: the head read too far forward on its neck): the neck's
 *   column leaning up into the skull moves the seam ring the skin is cut on. The one skin is pinned under laws 2 as it
 *   was, byte for byte, and under laws 3 beside it.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const PARTS = ['neck', 'cranium', 'jaw', 'visage', 'nose', 'eyeR', 'eyeL', 'earR', 'earL'];
const PINS = { male: '4169440b02426371', female: '99a2ed29cbc62a38' };
// the ONE SKIN (realistic laws 2, hero-one-skin.js): the skin, the mouth, the globes in place of the pieces
const ONE_PARTS = ['neck', 'headSkin', 'mouth', 'globeR', 'globeL', 'earR', 'earL'];
const ONE_PINS = { male: 'd141a71485ddcf02', female: '54cd21f82280678f' };
// the CERVICAL NECK (realistic laws 3, body-relational-builds.js CERVICAL_NECK): the one skin on the leaning neck
const NECK_PINS = { male: '459d30a9fc5f3008', female: '23a186409b0578cd' };
// the EAR RAISED to the canon (realistic laws 10, head-relational.js EAR_RAISE): its top at the brow line, the lobule at
// the nose's base (the one skin's ear and the skin it welds to move with it)
const EAR_PINS = { male: '0f388164cbe3cf89', female: '4f512d419c09c8d3' };
// the lids SEATED (realistic laws 11, head-relational-eye.js SEAT: the brow's arc and ties lower, the fold a pad, a deep-set
// eye forward), over the ear raised; re-pinned when the seat (laws 10 on 1027-hero-pack-v2) came after the raised ear
const SEATED_PINS = { male: '8433041062f5791b', female: '62a42715c85075d3' };
const pinOf = (r, parts) => createHash('sha256').update(JSON.stringify({ parts: Object.fromEntries(parts.map((k) => [k, r.parts[k]])), jaw: [r.rig.joints.jawHinge, r.rig.joints.jawTip] })).digest('hex').slice(0, 16);

describe('the relational head, pinned', () => {
  // (the pieces: realistic laws 1, as a hero minted before the one skin reads)
  for (const [cast, pin] of Object.entries(PINS)) it(cast, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational', physique: { from: 'athletic', laws: 1 } }) }).recipe;
    expect(pinOf(r, PARTS)).toBe(pin);
  });
  for (const [cast, pin] of Object.entries(ONE_PINS)) it(`${cast}, one skin`, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational', physique: { from: 'athletic', laws: 2 } }) }).recipe;
    expect(pinOf(r, ONE_PARTS)).toBe(pin);
  });
  // (laws 9: the cervical neck's head as it stood before the ear was raised)
  for (const [cast, pin] of Object.entries(NECK_PINS)) it(`${cast}, one skin on the cervical neck`, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational', physique: { from: 'athletic', laws: 9 } }) }).recipe;
    expect(pinOf(r, ONE_PARTS)).toBe(pin);
  });
  for (const [cast, pin] of Object.entries(EAR_PINS)) it(`${cast}, the ear raised`, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational', physique: { from: 'athletic', laws: 10 } }) }).recipe;
    expect(r.headFit.seat).toBeUndefined();
    expect(pinOf(r, ONE_PARTS)).toBe(pin);
  });
  // (a hero minted now, laws 11, has its lids seated on the globes: head-relational-eye.js SEAT)
  for (const [cast, pin] of Object.entries(SEATED_PINS)) it(`${cast}, one skin, the ear raised, the lids seated`, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational' }) }).recipe;
    expect(r.headFit.seat).toBe(true);
    expect(pinOf(r, ONE_PARTS)).toBe(pin);
  });
});
