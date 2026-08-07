/**
 * machina/recipe.js — parse a plain-JSON recipe (the MCP tool's input) into verify()'s native types,
 * and run it. Operators pass numbers + unit strings ({ value, unit }); this is the only place that
 * crosses from JSON into Quantities / transformers, so the tool handler stays thin and this stays pure.
 *
 * Recipe shape:
 *   {
 *     demand: { unitMass?:{value,unit}, unitWeight?:{value,unit}, count, distance:{value,unit},
 *               time?:{value,unit}, unitsPerCycle?, g? },           // mass→weight via g (default earth)
 *     mechanism: [ { type:'lever'|'wheelAxle'|'pulley'|'incline'|'wedge'|'screw', eta?, ...params } ],
 *     capacities: [ { type:'force', rating:{value,unit}, on? }
 *                 | { type:'rate', power?:{value,unit}, throughput?:{value,per} }
 *                 | { type:'storage', rating } ],
 *   }
 */

import { qty, count, weight, G } from './quantities.js';
import { lever, wheelAxle, pulley, incline, wedge, screw } from './machines.js';
import { forceCapacity, rateCapacity, storageCapacity, throughput } from './capacity.js';
import { verify } from './verify.js';
import { formatReport } from './report.js';

const Q = (o, fallbackUnit = '') => qty(o?.value, o?.unit ?? fallbackUnit);

const MACHINE_FACTORY = { lever, wheelAxle, pulley, incline, wedge, screw };
const MACHINE_DESC = {
  lever: (p) => `lever, arms ${p.effortArm}/${p.loadArm} (η ${pctEta(p.eta)})`,
  wheelAxle: (p) => `wheel & axle ${p.wheelR}/${p.axleR} (η ${pctEta(p.eta)})`,
  pulley: (p) => `${p.segments}-fall pulley (η ${pctEta(p.eta)})`,
  incline: (p) => `incline ${p.slope} m over ${p.height} m rise (η ${pctEta(p.eta)})`,
  wedge: (p) => `wedge ${p.length}/${p.thickness} (η ${pctEta(p.eta)})`,
  screw: (p) => `screw, ${p.pitch} m pitch, ${p.leverR} m lever (η ${pctEta(p.eta)})`,
};
const pctEta = (e) => `${Math.round((e ?? 1) * 100)}%`;

// ── build verify()'s three inputs from a recipe ──
export function buildFromRecipe(recipe = {}) {
  const r = recipe.demand || {};
  const unitWeight = r.unitWeight ? Q(r.unitWeight, 'N')
    : weight(Q(r.unitMass, 'kg'), Number.isFinite(+r.g) ? +r.g : G.earth);
  const demand = {
    unitWeight,
    count: count(r.count),
    distance: Q(r.distance, 'm'),
    ...(r.time ? { time: Q(r.time, 's') } : {}),
    ...(Number.isFinite(+r.unitsPerCycle) ? { unitsPerCycle: +r.unitsPerCycle } : {}),
  };

  const mechanism = (recipe.mechanism || []).map((m) => {
    const f = MACHINE_FACTORY[m.type];
    if (!f) throw new Error(`machina/recipe: unknown machine type "${m.type}"`);
    return f(m);
  });
  const mechanismDesc = (recipe.mechanism || []).map((m) => (MACHINE_DESC[m.type] ? MACHINE_DESC[m.type](m) : m.type));

  const capacities = (recipe.capacities || []).map((c) => {
    if (c.type === 'force') return forceCapacity({ rating: Q(c.rating, 'N'), on: c.on });
    if (c.type === 'rate') return rateCapacity({ power: c.power ? Q(c.power, 'W') : null, throughput: c.throughput ? throughput(c.throughput.value, c.throughput.per) : null });
    if (c.type === 'storage') return storageCapacity({ rating: c.rating });
    throw new Error(`machina/recipe: unknown capacity type "${c.type}"`);
  });

  return { demand, mechanism, capacities, mechanismDesc };
}

// ── run a recipe end to end → { feasible, binding, report (markdown), verdict (structured) } ──
export function runRecipe(recipe = {}) {
  const { demand, mechanism, capacities, mechanismDesc } = buildFromRecipe(recipe);
  const v = verify(demand, mechanism, capacities);
  const report = formatReport(v, { title: recipe.title, intent: recipe.intent, mechanismDesc });
  const d = v.demand;
  return {
    feasible: v.feasible,
    binding: v.binding,
    report,
    verdict: {
      mechanism: { netIma: d.mechanism.netIma, netEta: d.mechanism.netEta, netAma: d.mechanism.netAma, effort: d.mechanism.effort },
      demand: { cycles: d.cycles, workOutTotal: d.workOutTotal, workInTotal: d.workInTotal, lossTotal: d.lossTotal, powerRequiredW: d.powerRequiredW, peakBorneForce: d.peakBorneForce },
      invariants: v.invariants,
    },
  };
}
