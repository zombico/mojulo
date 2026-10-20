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
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const PARTS = ['neck', 'cranium', 'jaw', 'visage', 'nose', 'eyeR', 'eyeL', 'earR', 'earL'];
const PINS = { male: '77334ad0c5bbf65e', female: '3d4776b597017dcd' };

describe('the relational head, pinned', () => {
  for (const [cast, pin] of Object.entries(PINS)) it(cast, { timeout: 240000 }, () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, form: 'realistic', head: 'relational' }) }).recipe;
    const pick = { parts: Object.fromEntries(PARTS.map((k) => [k, r.parts[k]])), jaw: [r.rig.joints.jawHinge, r.rig.joints.jawTip] };
    expect(createHash('sha256').update(JSON.stringify(pick)).digest('hex').slice(0, 16)).toBe(pin);
  });
});
