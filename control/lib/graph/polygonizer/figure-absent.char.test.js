/**
 * figure absent-channel characterization net (outfit.plan.md, P1 gate).
 *
 * Hash-pins the SVG of figures that wear NO cut-and-sewn garment and NO `outfit`: a shell
 * outfit, a posed shell dress, and a bare body. The hashes were computed on a `main` worktree
 * at 2.0.2 (2026-09-13) BEFORE the pattern-garment / outfit work, so they pin the promise that
 * an absent opt-in channel contributes zero bytes — not merely that the render is deterministic.
 *
 * Re-pinning is legitimate ONLY alongside a plan phase that says the legacy figure emission
 * changes (the emit-channels.char.test.js contract).
 *
 * Re-pin log:
 * - 2026-09-14, footwear P0 (the flat stand). All three. A figure that says nothing
 *   about its feet now stands with its soles ON THE FLOOR: `flatOf` (figure-render.js) falls
 *   back to 1, not 0, when neither `footFlat` nor `plant` is given. Before, the foot was built
 *   ⊥ to the shank and the rest shank tilts 11° back, so every standing figure balanced on its
 *   toe tip with the heel ≈ 3.8 cm in the air (sole pitch 11.3°). The three figures here are all
 *   standing, so all three move; the walk and the sprint pass `plant` / `footFlat` explicitly and
 *   are byte-identical (16 frames checked). The absent-channel PROMISE is unchanged — these
 *   hashes still pin that a figure with no pattern garment and no `outfit` costs zero bytes for
 *   those channels; only the legacy stand itself was corrected.
 * - 2026-09-14, footwear (the big toe). All three, again, and for the same kind of reason: the
 *   FOOT'S SHAPE changed. The forefoot was a symmetric spearhead tapering to a point on the
 *   midline — the same shape on both feet, with no handedness at all. The big toe now LEADS and
 *   sits medially, the toe line slants back to the little toe, and the two feet are exact mirrors,
 *   so a shoe last has a side to be drafted for. The forefoot then gained a `roll` and a blunt
 *   `box` station and a small closing `tip` — the narrow cap walked medially read as a BLADE, and
 *   widening it exposed the hole every ring stack has at its end (`litFaces` caps neither end).
 *   The foot was then RESIZED: it measured 18.1 % of stature, a EU 47 on a 170 cm figure, where a
 *   human foot is about 15 % — and a shoe drafted from that tape would have printed at that size.
 *   Length, breadth and depth scale together, so the shape is the one above and only the size
 *   changed. The sole is part of the body's z extent, so `worldPerCm` moves with it and every
 *   tape reading rises ~0.4 % (female @165: bust 93.3 → 93.7, hip 113.3 → 113.8).
 *   `figure-foot.test.js` holds all of it; these hashes only record that the flesh moved.
 * - 2026-09-17, figure-head. All three: the HEAD changed. It was two overlapping open tubes (a
 *   three-bead vajra egg and a forward "face mask" sleeve) with holes at the crown and the
 *   underside and no sex; it is now one closed latitude-marched field of named anatomical
 *   primitives with a male and a female pole (figure-head.js), and the neck girth follows the
 *   pole. The bare figure's head, the posed male's head and the female's head + neck all moved;
 *   `figure-head.test.js` holds the closure, the canon and the dimorphism. The absent-channel
 *   PROMISE is unchanged: no pattern garment and no `outfit` still cost zero bytes. Re-pinned once
 *   more the same day when the soft CHEEK (malar pad + jowl blend, the `cheek` knob) joined the
 *   field — the canonical face rounded out; nothing else moved. And once more after the operator's
 *   eyes gate: the back of the mandible narrowed under the cheek line and the cheek grew ~20 %.
 *   Round 2: the nose was articulated (bridge, dorsum, tip ball, alae, columella; `noseWidth`),
 *   then reseated AT the face plane with a hooked tip and a flat underside (`noseDroop`).
 *   Round 3: the nose pulled back and narrowed a little; the male forehead stood up.
 *   Round 4: the nose pulled back further, the base narrowed, the dorsal bridge widened laterally.
 *   Round 5: the nose base segmented (alae / tip / columella as three lobes, alar creases) and the
 *   around-sampling biased to the face (44 samples, 2x density at +y) so the lobes can exist.
 *   Round 6: the philtrum recessed and the nose joined to the face tighter, so the underside
 *   stands over air (the space between nose and lip is empty).
 *   Round 7: the mouth raised, the jaw rests rotated up 6° about the hinge, the nose-base cuts softened.
 *   Round 8: the lips got mass (their own tight group with a tubercle and a lip line).
 *   Round 9: the mouth traced cheek to cheek, the lips rest in place (only the bone rests rotated),
 *   a sulcus under the lower lip, 52 latitudes so the lip line has a ring to draw on.
 *   Round 10: the upper lip filled — wider base, peak raised to the bottom of the philtrum.
 *   Round 11: the upper lip volumized forward + sideways (lateral lobes); the philtrum a narrow groove.
 *   Round 12: the lips rebuilt on ONE M-shaped mouth path (cupid's bow), the line a shadow step.
 *   Round 13: the lower inner cheek flattened (a buccal plane) so the mouth corners merge into the face.
 * - 2026-09-18, the head's FEATURES. All three moved again — five additions to the same field,
 *   none of which changes a channel's presence, so the absent-channel promise still holds:
 *   the EAR became a real feature (a helix rim of round cones from the root over the top and down
 *   the back to the lobule, thickened by two pads FLATTENED in x, with a thin pinna plate — its
 *   own blend group and gate, because at the face's 0.019*s blend the old single tragion lobe
 *   melted into the temple and contributed width but no shape); the ZYGOMATIC ARCH and a light
 *   MASSETER filled the trough the side of the face fell into between the cheekbone and the ear
 *   (3.7 mm real bare, which the new ear deepened to 4.5 mm by raising the wall behind it);
 *   the NOSE TIP became an ellipsoid plus an infratip lobule and gained a dorsal KEEL, so it
 *   domes and reads as a forward pyramid with one continuous ridge instead of a flat facet —
 *   and NARROWER, not wider, at the tip; the EYE arrived as a globe in the orbit under two
 *   C-wave lids, unioned after the orbit subtraction and with that cut trimmed to suit.
 *   Two knobs joined the head: `earSize`, `eyeSize`. `figure-head.test.js` holds all of it.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { renderFigureToSvg } from './figure-render.js';

const sha = (s) => createHash('sha256').update(s).digest('hex');

const PINS = {
  femaleTeeTrousers: {
    manifest: { kind: 'figure', proto: { sex: 'female' }, garment: ['tee', 'trousers'], view: 'three-quarter' },
    hash: 'ae3928a343b96502c79c606822949ffb484a3820dc4b1bdff159fd7bd1565dbe',
  },
  maleDressPosed: {
    manifest: { kind: 'figure', proto: { sex: 'male' }, garment: 'dress', pose: { shL: { pitch: 40 }, kneeR: 30 }, view: 'lateral' },
    hash: '64186f2e3bf23797619a61f35dd6774444e86a35054165db54e6d7f2e9810850',
  },
  bare: {
    manifest: { kind: 'figure', view: 'frontal' },
    hash: '7619dc90116e9b2a9b079d8e0286205fcce79ba12877e30c65e2f83e7027de0f',
  },
};

describe('figure absent-channel pins (pre-branch hashes)', () => {
  for (const [name, { manifest, hash }] of Object.entries(PINS)) {
    it(`${name} renders byte-identical to 2.0.2`, () => {
      expect(sha(renderFigureToSvg(manifest))).toBe(hash);
    });
  }
});
