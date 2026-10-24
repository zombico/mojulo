// hero-one-skin.deep.test.js — the ONE SKIN (hero-one-skin.js) is a pipe, not a set of hand-fixed heads: faces ROLLED at
// mint (seeds and ethnicities no eye has seen, both poles) each pass its machine gates unattended. The skin, the mouth
// and the globes sound (manifold, wound one way, no face without area); the rim on the neck's seam ring, every seam
// point a rim point; two open rims and no others (the seam and the lips' cut: no hole a pinch left); the lips doubled
// along the cut, the head's above and the jaw's below; the budget held. (Deep tier: each face is a realistic mint.)
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { boundaryLoops } from './skin-net.js';
import { ONE_SKIN } from './hero-one-skin.js';

// (rolled faces: each sex, each a population the composer reads differently; seeds chosen by nothing)
const FACES = [['male', 'south-asian', 7], ['female', 'dravidian', 8], ['male', 'african', 2], ['female', 'north-asian', 6], ['male', 'mixed', 4], ['female', 'levantine', 9]];

describe('the one skin over rolled faces', () => {
  for (const [cast, ethnicity, seed] of FACES) it(`${cast} ${ethnicity} ${seed}`, { timeout: 300_000 }, () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ form: 'realistic', cast, face: { seed, ethnicity } }) }), P = m.recipe.parts;
    const A = auditLayered(compileLayered(m.recipe, m.dials));
    for (const k of ['headSkin', 'mouth', 'globeR', 'globeL', 'neck']) expect(A[k], k).toMatchObject({ pass: true, nonManifold: 0, windingErrors: 0, degenerate: 0 });
    const S = P.headSkin.mesh, ids = Object.keys(S.points), ix = new Map(ids.map((id, i) => [id, i]));
    const pts = new Set(Object.values(S.points).map((p) => p.join()));
    for (const p of Object.values(P.neck.stations.at(-1).points)) expect(pts.has(p.join())).toBe(true);
    expect(boundaryLoops(Object.values(S.faces).map((t) => t.map((id) => ix.get(id))))).toHaveLength(2);
    const B = P.headSkin.bind.blend, at = new Map(); let pairs = 0;
    for (const [id, p] of Object.entries(S.points)) { const k = p.join(), j = B[`st0.${id}`]?.jaw ?? 0; if (at.has(k) && Math.abs(at.get(k) - j) === 1) pairs++; else at.set(k, j); }
    expect(pairs).toBeGreaterThan(20);
    expect(Object.keys(S.faces).length).toBeLessThan(ONE_SKIN.faces * 1.15);
  });
});
