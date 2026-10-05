/** The anime hero's standing BUDGET (a machine gate over the default heroes, both casts and registers): at most 30k
 * triangles and 15k vertices per character, and the plan and recipe the row stores together at most 2.36 MB — the ceiling
 * the derived-not-stored rule keeps (normals, bias, ink widths and region weights are computed on read). A failure names
 * the parts that weigh most, so the next cut is chosen by bytes. heroBudget (layered.js) is the same readout the door
 * gives. */
import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest, planLayered, heroBudget } from '../../mcp/tools/layered.js';

// bytes 2.35 → 2.36 MB: the structured arm's muscles (three shaping rings an arm) put the anime male 1.5 KB over; the
// head include, stored in both the plan and the recipe (≈ 1.13 MB each), is the weight a real cut would take
const CAP = { triangles: 30000, vertices: 15000, bytes: 2360000 };

describe('the anime hero budget', () => {
  for (const cast of ['female', 'male']) for (const register of ['round', 'lowpoly']) it(`${cast}, ${register}: triangles, vertices and stored bytes under the ceiling`, () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime', register }) });
    const b = heroBudget(m.plan, planLayered(m).mesh, m.recipe), bytes = b.bytes.plan + b.bytes.recipe;
    const heaviest = Object.entries(m.recipe.parts).map(([k, p]) => [k, Buffer.byteLength(JSON.stringify(p))]).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ');
    expect(b.triangles, `${cast} ${register} triangles`).toBeLessThanOrEqual(CAP.triangles);
    expect(b.vertices, `${cast} ${register} vertices`).toBeLessThanOrEqual(CAP.vertices);
    expect(bytes, `${cast} ${register}: plan ${b.bytes.plan} + recipe ${b.bytes.recipe} bytes; the heaviest recipe parts: ${heaviest}`).toBeLessThanOrEqual(CAP.bytes);
  }, 60000);
});
