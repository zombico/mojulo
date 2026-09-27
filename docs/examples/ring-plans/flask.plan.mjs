/** flask.plan.mjs — a wicker-wrapped flask: the dragon's detail and adornment passes on an OBJECT, through the plain plan
 * door (`mint_solid({ kind: 'layered', via: 'plan', spec: { plan } })`). One trunk (a glass bottle, midline-mirrored);
 * `body`: a woven wicker jacket grown as brick tiles round the belly (seeded wobble so the weave is not a grille) and a
 * ring at the lip; `adorn`: a leather band at the shoulder with a brass buckle as its signature. No bones, no joints:
 * the rigid-on-rigid gate reads an unbound part as its own bone, so every tile grows.
 *   node flask.plan.mjs → flask.plan.json (the canonical plan) */
import { writeFileSync } from 'node:fs';

export function flaskPlan({ register = 'round' } = {}) {
  const e = { round: 2, chamfer: 6, box: 12 }[register] ?? 2; const H = 6;   // ring12: the half ring runs 0 (front) → 6 (back)
  return {
    schema: 'layered-plan-v1', frame: { up: '+z', front: '+y', note: `1 unit = 1 m; a wicker-wrapped flask, ${register}` },
    style: { slots: 'ring12', limbSlots: 'limb6', e },
    joints: {},
    segments: [{ name: 'flask', kind: 'trunk', mirror: 'plane', group: 'Glass', caps: { back: [0, 0, -0.002], tip: [0, 0, 0.286] },
      stations: [{ z: 0, r: 0.062 }, { z: 0.018, r: 0.088 }, { z: 0.085, r: 0.097 }, { z: 0.15, r: 0.092 }, { z: 0.2, r: 0.06 }, { z: 0.232, r: 0.024 }, { z: 0.27, r: 0.022 }, { z: 0.284, r: 0.026 }] }],
    palette: { Glass: '#5d7f63', Wicker: '#b08a52', WickerAlt: '#9c7743', Lip: '#4d6a53', Leather: '#6a4327', Brass: '#c9a24a' },
    body: {
      tiles: [{ id: 'wicker', parts: ['flask'], s: [0.35, 3.55], t: [0, H], grid: [9, 7], brick: true, sides: 4, coverage: 1.04, inset: 0.18, height: 0.0045, lean: 0, wobble: 0.06, jitter: 0.12, group: ['Wicker', 'WickerAlt'] }],
      collars: [{ id: 'lip.flask', part: 'flask', at: 'st7', height: 0.14, width: 0.6, group: 'Lip' }],
    },
    adorn: [{ id: 'band', mode: 'band', part: 'flask', s: [3.62, 3.92], t: 'wrap', nt: 16, ns: 2, mugen: 0.002, thick: 0.004, rad: 0.02, group: 'Leather',
      signature: { kind: 'buckle', k: 0, j: 1, w: 0.014, h: 0.012, bar: 0.003, standoff: 0.003, group: 'Brass' } }],
  };
}
export const plan = flaskPlan();
if (process.argv[1] === new URL(import.meta.url).pathname) writeFileSync(new URL('./flask.plan.json', import.meta.url), JSON.stringify(plan, null, 2) + '\n');
