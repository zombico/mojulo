/** The anime hero's standing BUDGET (a machine gate over the default and the bare heroes, both casts and registers): at
 * most 30k triangles and 15k vertices per character, and the plan and recipe the row stores together at most 1.4 MB —
 * the ceiling the derived-not-stored rule keeps (normals, bias, ink widths and region weights are computed on read, the
 * recipe's copy of the head put back from the plan). A failure names
 * the parts that weigh most, so the next cut is chosen by bytes. heroBudget (layered.js) is the same readout the door
 * gives. */
import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest, planLayered, heroBudget } from '../../mcp/tools/layered.js';

// bytes 2.36 → 1.4 MB: the row stores the anime head once (manifest-store.js: the recipe names the plan's include for
// the parts it copies whole, ≈ 1.12 MB), so the heaviest hero, the bare anime male, stores 1.256 MB; the ceiling keeps
// ≈ 145 KB of room for the body (2.36 MB had been raised for the arms' 1.5 KB while the head was stored twice)
const CAP = { triangles: 30000, vertices: 15000, bytes: 1400000 };

describe('the anime hero budget', () => {
  // shod (the default) and bare (the swimsuit: the feet in place of the shoes)
  for (const cast of ['female', 'male']) for (const register of ['round', 'lowpoly']) for (const detail of [undefined, 'swimsuit']) it(`${cast}, ${register}${detail ? `, ${detail}` : ''}: triangles, vertices and stored bytes under the ceiling`, () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime', register, ...(detail ? { detail } : {}) }) });
    const b = heroBudget(m.plan, planLayered(m).mesh, m.recipe), bytes = b.bytes.plan + b.bytes.recipe;
    const heaviest = Object.entries(m.recipe.parts).map(([k, p]) => [k, Buffer.byteLength(JSON.stringify(p))]).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ');
    expect(b.triangles, `${cast} ${register} triangles`).toBeLessThanOrEqual(CAP.triangles);
    expect(b.vertices, `${cast} ${register} vertices`).toBeLessThanOrEqual(CAP.vertices);
    expect(bytes, `${cast} ${register}: plan ${b.bytes.plan} + recipe ${b.bytes.recipe} bytes; the heaviest recipe parts: ${heaviest}`).toBeLessThanOrEqual(CAP.bytes);
  }, 60000);
});
