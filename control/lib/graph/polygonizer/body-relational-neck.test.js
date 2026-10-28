// The realistic neck leans up into the skull (realistic laws 3, body-relational-builds.js CERVICAL_NECK): read on the
// midline skin in profile, the head sits on its neck as a person's does, the skull's back well behind the nape and the
// jaw not jutting far past the throat; under laws 2 the neck rose straight, the nape under the back of the skull. One
// body (the woman's: her jaw jutted the more). (Beside the module, not in the critical tier: two realistic mints.)
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest, REALISTIC_LAWS_VERSION } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';

/** the midline profile: the skin's back and front (y, the figure facing +y) in a band about each height */
function profileOf(spec, at0 = null) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }), mesh = compileLayered(m.recipe);
  const V = mesh.vertices, part = mesh.provenance.map((p) => p.part), skin = /^(headSkin|neck|torso)$/;
  const at = (z) => { const S = V.filter((p, i) => skin.test(part[i]) && Math.abs(p[0]) < 0.012 && Math.abs(p[2] - z) < 0.006); return { back: Math.min(...S.map((p) => p[1])), front: Math.max(...S.map((p) => p[1])) }; };
  // (the bands hang off the ear's height; `at0` another mint's, so a raised ear, realistic laws 10, moves none of them)
  const ear = V.filter((_, i) => part[i] === 'earR'), earZ = at0 ?? ear.reduce((t, p) => t + p[2], 0) / ear.length;
  // (the skull's back: its furthest point behind; the nape: the neck's back under the skull, a band below the ear canal;
  // the chin's front and the throat under it: the face's front at its lowest and the neck's front a step below)
  const zs = Array.from({ length: 31 }, (_, k) => earZ - 0.12 + k * 0.01), rows = zs.map((z) => ({ z, ...at(z) }));
  const occiput = Math.min(...rows.filter((r) => r.z > earZ - 0.02).map((r) => r.back));
  const nape = Math.max(...rows.filter((r) => r.z < earZ - 0.03 && r.z > earZ - 0.07).map((r) => r.back));
  const chinRow = rows.filter((r) => r.z < earZ - 0.03).reduce((a, r) => (r.front > 0.08 && r.z < a.z ? r : a), { z: Infinity }), throat = at(chinRow.z - 0.02).front;
  return { behind: nape - occiput, jut: chinRow.front - throat, earZ };
}

describe('the realistic neck leans up into the skull', () => {
  it('under laws 3 the skull\'s back stands well behind the nape and the jaw no further past the throat than a person\'s; laws 2 as it was', { timeout: 300_000 }, () => {
    expect(REALISTIC_LAWS_VERSION).toBeGreaterThanOrEqual(3);
    const spec = { form: 'realistic', cast: 'female', face: { seed: 11, ethnicity: 'western' } };
    const before = profileOf({ ...spec, physique: { from: 'athletic', laws: 2 } }), now = profileOf(spec, before.earZ);
    expect(now.behind).toBeGreaterThan(before.behind + 0.008);
    expect(now.behind).toBeGreaterThan(0.038);
    expect(now.jut).toBeLessThan(before.jut - 0.008);
    expect(now.jut).toBeGreaterThan(0.045); expect(now.jut).toBeLessThan(0.065);
  });
});
