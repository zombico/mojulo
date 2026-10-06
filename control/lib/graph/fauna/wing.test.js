import { describe, it, expect } from 'vitest';
import { buildWing } from './wing.js';
import { featherWing } from './families/avian.js';
import { speciesPlan } from './species.js';

// a membrane wing (bat pattern) as data, to exercise the op's other surface
const MEMBRANE = { girdle: 'g', boneGroup: 'Bone', surface: 'membrane',
  arm: [{ id: 'a0', len: 0.55, spread: 20, folded: -70, r: [0.075, 0.055] }, { id: 'a1', len: 0.85, spread: -30, folded: 160, r: [0.05, 0.035] }],
  rays: [{ name: 'body', bone: 0, at: 0, angle: 105, foldAngle: 15, len: 1.05 },
    { digit: 'V', bone: 1, at: 1, angle: 78, foldAngle: 172, len: 1.25, r: [0.028, 0.012], offset: 0.03 },
    { digit: 'III', bone: 1, at: 1, angle: 28, foldAngle: 176, len: 1.7, r: [0.032, 0.012], offset: 0.03 }],
  membrane: { order: [0, 1, 2], sag: [0.16, 0.2], sub: 6, along: [0, 0.3, 0.7, 1], thickness: 0.007, groups: { top: 'T', under: 'U', rim: 'R', vein: 'V' } },
  frame: { spread: { S: [1, -0.35, 0.5], C: [0, 0.05, 1] }, folded: { S: [0.25, -1, -0.1], C: [0.05, 0, 1] } } };

const audit = (w) => { let open = 0, wind = 0;
  for (const d of Object.values(w.parts)) { const E = new Map();
    for (const f of d.faces) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const k = a < b ? `${a}|${b}` : `${b}|${a}`; const e = E.get(k) || [0, 0]; e[0]++; e[1] += a < b ? 1 : -1; E.set(k, e); }
    for (const [c, bal] of E.values()) { if (c !== 2) open++; else if (bal) wind++; } }
  return { open, wind }; };

describe('wing op', () => {
  it('is closed and consistently wound spread, half folded and folded, both sides, both surfaces', () => {
    for (const W of [featherWing(), MEMBRANE]) for (const f of [0, 0.5, 1]) for (const side of ['R', 'L']) expect(audit(buildWing(W, [0.1, 0.1, 0.8], f, side))).toEqual({ open: 0, wind: 0 });
  });
  it('is deterministic', () => {
    expect(JSON.stringify(buildWing(featherWing(), [0, 0, 0], 0.5))).toBe(JSON.stringify(buildWing(featherWing(), [0, 0, 0], 0.5)));
    expect(JSON.stringify(speciesPlan('vulture'))).toBe(JSON.stringify(speciesPlan('vulture')));
  });
  it('keeps bone lengths under the fold; every vane rides exactly one bone; membrane weights sum to 1', () => {
    const lens = (w) => w.bones.map((b) => Math.hypot(...b.tail.map((x, i) => x - b.head[i])));
    const rest = lens(buildWing(featherWing(), [0, 0, 0], 0));
    for (const f of [0.5, 1]) lens(buildWing(featherWing(), [0, 0, 0], f)).forEach((l, i) => expect(Math.abs(l - rest[i])).toBeLessThan(1e-9));
    const v = buildWing(featherWing(), [0, 0, 0], 0); expect(Object.keys(v.bind).length).toBeGreaterThan(50);
    for (const b of Object.values(v.bind)) expect(Object.keys(b)).toHaveLength(1);
    for (const o of buildWing(MEMBRANE, [0, 0, 0], 0.5).bind.membrane) expect(Math.abs(Object.values(o).reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-12);
  });
  it('the vulture wears its wings as pinned layer-2 parts; fold changes them', () => {
    const p = speciesPlan('vulture'); const inc = p.include.find((x) => x.name === 'wings');
    expect(Object.keys(inc.parts)).toEqual(['wingR', 'wingL']); expect(inc.parts.wingR.pin.parent).toBe('wingCoreR');
  });
});
