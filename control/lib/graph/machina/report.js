/**
 * machina/report.js — turns a verify() result into the operator-facing feasibility report (markdown).
 * Shared by the MCP tool and the integration spike so both speak the same verdict language. Pure.
 */

const pct = (f) => (Number.isFinite(f) ? Math.round(f * 100) + '%' : '∞');
const kJ = (j) => (j / 1000).toFixed(0) + ' kJ';

// one invariant line
function invLine(inv) {
  if (inv.kind === 'conservation') {
    return `  ${inv.ok ? '✓' : '✗'} conservation   W_in ${kJ(inv.workIn)} ≥ W_out ${kJ(inv.workOut)}  (no free lunch; η ${pct(inv.netEta)})`;
  }
  if (inv.kind === 'rate') {
    const sub = inv.parts.map((p) => `${p.sub} ${pct(p.utilization)}${p.ok ? '' : ' ✗OVER'}`).join(', ');
    return `  ${inv.ok ? '✓' : '✗'} rate           ${sub || '(no temporal demand)'}`;
  }
  const head = inv.marginAbs >= 0 ? `${inv.marginAbs.toFixed(0)} ${inv.unit} headroom` : `${(-inv.marginAbs).toFixed(0)} ${inv.unit} OVER`;
  return `  ${inv.ok ? '✓' : '✗'} ${inv.name.padEnd(14)} ${pct(inv.utilization)} used · ${head}`;
}

// full report for one verified design. `meta` carries optional { title, intent, mechanismDesc:[] }.
export function formatReport(v, meta = {}) {
  const d = v.demand, mx = d.mechanism;
  const L = [];
  if (meta.title) L.push(`## ${meta.title}`, '');
  if (meta.intent) L.push(`**Intent.** ${meta.intent}`, '');
  if (meta.mechanismDesc && meta.mechanismDesc.length) {
    L.push('**Mechanism (effort → load)**');
    meta.mechanismDesc.forEach((m, i) => L.push(`  ${i + 1}. ${m}`));
    L.push('');
  }
  L.push('**Resolved**');
  L.push(`  • net advantage   ${mx.netAma.toFixed(1)} : 1   (ideal ${mx.netIma.toFixed(1)}:1, efficiency ${pct(mx.netEta)})`);
  L.push(`  • effort needed   ${mx.effort.force.toFixed(0)} N over ${mx.effort.distance.toFixed(2)} m per cycle  ·  ${d.cycles} cycle(s)`);
  L.push(`  • work delivered  ${kJ(d.workOutTotal)}   |   work spent ${kJ(d.workInTotal)}   |   lost to friction ${kJ(d.lossTotal)}`);
  if (d.powerRequiredW != null) L.push(`  • sustained power ${d.powerRequiredW.toFixed(0)} W`);
  L.push('');
  L.push(`**Verdict: ${v.feasible ? '✅ FEASIBLE' : '❌ NOT FEASIBLE'}**${v.binding.length ? ` — binding: ${v.binding.join(', ')}` : ''}`);
  for (const inv of v.invariants) L.push(invLine(inv));
  return L.join('\n');
}
