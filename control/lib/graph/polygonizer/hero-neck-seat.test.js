// The head seated on its neck (hero laws 16, hero-form.js CERVICAL_LEAN, tiered-form.js TIERED_OCCIPUT): read on the
// game body's midline silhouette (the mesh cut by x = 0), the back of the skull stands over the nape as people's does
// (4 to 5 cm) and the jaw past the throat; under laws 15 the man's skull barely cleared his nape, the column upright
// under the back of his head. One body per cast, as the door mints it. (Beside the module, not in the critical tier.)
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from './motion-stamp.js';
import { compileLayered } from './station-loft.js';

const SKIN = /^(cranium|jaw|neck|torso)$/, HEAD = /^cranium$/;
/** the midline silhouette: at each height the skin's back and front (y, the figure facing +y), by its faces' edges
 * crossing x = 0 */
function profileOf(spec) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm(spec)) }), mesh = compileLayered(m.recipe), J = m.recipe.rig.joints;
  const V = mesh.vertices, part = mesh.provenance.map((p) => p.part), segs = [];
  for (const f of mesh.faces) {
    if (!SKIN.test(part[f[0]])) continue;
    const X = [];
    for (let k = 0; k < f.length; k++) { const a = V[f[k]], b = V[f[(k + 1) % f.length]]; if ((a[0] <= 0) !== (b[0] <= 0)) { const t = a[0] / (a[0] - b[0]); X.push([a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); } }
    if (X.length >= 2) segs.push([X[0], X[1], part[f[0]]]);
  }
  const at = (z) => { let back = [Infinity], front = [-Infinity]; for (const [p, q, n] of segs) { if ((p[1] - z) * (q[1] - z) > 0 || p[1] === q[1]) continue; const y = p[0] + ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]); if (y < back[0]) back = [y, n]; if (y > front[0]) front = [y, n]; } return { z, back, front }; };
  const nh = J.neckHub.at[2], rows = [];
  for (let z = J.headTop.at[2] + 0.1; z >= nh - 0.06; z -= 0.005) { const r = at(z); if (Number.isFinite(r.back[0])) rows.push(r); }
  // (the occiput: the skull's furthest point behind; the nape: the back line's most forward point under it, above the
  // neck's hub; the chin: the face's front where it last stands before falling back under the jaw; the throat 2 cm under)
  const occ = rows.reduce((a, r) => (r.back[0] < a.back[0] && HEAD.test(r.back[1]) ? r : a), { back: [Infinity] });
  const nape = rows.filter((r) => r.z < occ.z && r.z > nh + 0.03).reduce((a, r) => (r.back[0] > a.back[0] ? r : a), { back: [-Infinity] });
  const i = rows.findIndex((r, k) => r.z < J.headBase.at[2] + 0.01 && k + 1 < rows.length && rows[k + 1].front[0] < r.front[0] - 0.02);
  return { behind: nape.back[0] - occ.back[0], jut: rows[i].front[0] - at(rows[i].z - 0.02).front[0] };
}

describe('the head seated on its neck', () => {
  it('under laws 16 the skull\'s back stands over the nape as people\'s does, the man\'s from 2 cm; the jaw past the throat held', { timeout: 300_000 }, () => {
    for (const cast of ['male', 'female']) {
      const now = profileOf({ cast }), before = profileOf({ cast, laws: 15 });
      expect(now.behind, cast).toBeGreaterThan(0.038); expect(now.behind, cast).toBeLessThan(0.055);
      expect(now.behind, cast).toBeGreaterThan(before.behind + 0.006);
      expect(now.jut, cast).toBeGreaterThan(0.04); expect(now.jut, cast).toBeLessThan(0.065);
      expect(Math.abs(now.jut - before.jut), cast).toBeLessThan(0.006);
    }
  });
});
