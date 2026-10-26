// armor/hardsuit — the HARD-SUIT family: MOULDED shells over a bodysuit (law 12), a smooth helm, a power pack, glowing
// details. As an adornment kit for the hero. Pure data out; no dice.
//
// The family's own reads of the laws:
//   - SEGMENTATION IS PANEL LINES. A limb shell splits into `segments` whose gaps show the bodysuit (law 10): the
//     panel density is a dial of the card, not geometry detail.
//   - BULK IS STANDOFF (law 2 × mass). A power suit stands its shells far off the body; a trooper's plates sit close.
//   - THE FOCAL IS THE CARD'S: a domed pauldron with an emblem, the helm, or a chest reactor (law 1). Glow spends on it
//     and the lenses (law 5): the card's `emissive` groups render full-bright.
//   - A HELM IS A SOLID, sized from the head's bounds (the `helm` signature), never a shell over the face's topology.
//
// Coverage (law 9, per family): helm, cuirass, pauldrons, vambraces, greaves, boots, belt, thighs and knees, upper arms
// and elbows, gauntlets, the pack.
import { armorProportion } from './principles.js';
import { r4, edgeTrim } from './plate.js';

export const HARDSUIT_ORDER = Object.freeze([[0.0, 'helm'], [0.2, 'cuirass'], [0.3, 'pauldron'], [0.4, 'vambrace'], [0.5, 'greave'], [0.55, 'boot'], [0.6, 'belt'],
  [0.65, 'skirt'], [0.7, 'thigh'], [0.8, 'upperArm'], [0.9, 'gauntlet'], [0.95, 'glow'], [1.0, 'pack']]);
export const HELMS = Object.freeze(['power', 'trooper', 'faceplate', 'none']);
// THE ARCHETYPE WORDS (each optional; absent, the piece as it always was): the body's echo of a head's language
//   pauldron      + lames (three stacked lames down the arm: the ronin's, the legion's) | none;  pauldronSide both | R | L
//   chest         + plates (breast and back, no abdomen bands: the bounty hunter's) | box (a plate of lights on the
//                 chest: the dark lord's) | bands (the cuirass in wrapped bands: the legion's) | none (no cuirass)
//   arms          panels | manica (the sword arm in lames, shoulder to wrist: the gladiator's) | gadget (a glowing
//                 lens on each vambrace: the hunter's) | none
//   legs          panels | greaves (shins and knees, no thigh plates) | ocrea (one greave, the lead leg's) | none
//   skirt         none | pteruges (strips hanging from the belt all round) | tassets (a plate over each hip)
//   pack          + jet (two thrusters: the flier's);  glow none | lines (glowing strips down the limbs: the cyborg's)
//   collar        band | high | none;  fnSide R | L (the manica's arm), leadSide R | L (the ocrea's leg)
export const HARD_PAULDRONS = Object.freeze(['dome', 'cap', 'segmented', 'lames', 'none']);
export const CHESTS = Object.freeze(['plain', 'reactor', 'plates', 'box', 'bands', 'none']);
export const HARD_WORDS = Object.freeze({ arms: ['panels', 'manica', 'gadget', 'none'], legs: ['panels', 'greaves', 'ocrea', 'none'], skirt: ['none', 'pteruges', 'tassets'], glow: ['none', 'lines'], collar: ['band', 'high', 'none'], pauldronSide: ['both', 'R', 'L'] });

// the helm shapes: a superellipse exponent, the padding off the head, the bottom flare, the muzzle, the crown
const HELM_SHAPES = {
  power: { n: 2.2, pad: 0.03, flare: 0.5, muzzle: 0.04, crown: 0.85, visor: 'lenses', grille: 3 },
  trooper: { n: 2.3, pad: 0.022, flare: 0.28, muzzle: 0.014, crown: 0.9, visor: 't' },
  faceplate: { n: 3.2, pad: 0.014, flare: 0.08, muzzle: 0.008, crown: 0.95, visor: 'slits', faceplate: true },
};

/** a hard-suit at `dials.coverage` as one kit. lang: { helm, pauldron, chest, pack, segments, focal } */
export function hardSuit(dials, ctx, lang = {}) {
  const { Ht, Hl, k = 1, height = 1.75 } = ctx; const c = dials.coverage ?? 1;
  const Hth = ctx.Hth ?? Hl;   // the thigh's own ring half (the structured core's thigh takes the trunk's family)
  const law = armorProportion(dials), minF = law.minFeature * height, orn = dials.ornament ?? 1;
  const bulk = law.standoff, seg = Math.max(1, Math.min(3, lang.segments ?? 2));
  const thick = Math.max(minF, 0.005 * k * law.thick), mug = (m) => r4(m * k * bulk);
  const quiet = (group = 'Trim', j = -1) => ({ kind: 'studs', j, count: 1, r: r4(Math.max(minF * 0.5, 0.0025 * k)), h: r4(Math.max(minF * 0.3, 0.0015 * k)), m: 6, group });
  const shell = (o) => ({ mode: 'shell', nt: 12, ns: 3, thick, rad: r4(0.03 * k), group: 'Plate', rigid: true, signature: quiet(), ...o });
  // a limb run split into `seg` panels with gaps (the panel lines), each riding the limb's own bone
  const panels = (id, part, s0, s1, extra = {}) => { const gap = 0.06, L = (s1 - s0 - gap * (seg - 1)) / seg;
    return Array.from({ length: seg }, (_, i) => shell({ id: `${id}${i}`, part, s: [r4(s0 + i * (L + gap)), r4(s0 + i * (L + gap) + L)], ...extra })); };
  const other = (S) => (S === 'R' ? 'L' : 'R'), focalSide = lang.focalSide ?? 'R';
  const trace = { worn: [] };
  const PIECES = {
    helm: () => { if (lang.helm === 'none') return [];   // bareheaded (no piece, so `worn` leaves it out)
      const H = { ...HELM_SHAPES[lang.helm ?? 'trooper'] };
      // law 2: a stylized helm is bigger and rounder off the head; its visor is the face
      return [{ id: 'cranium-helm', mode: 'shell', part: 'cranium', s: [6.6, 8], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: r4(minF), rad: r4(0.01 * k), group: 'Suit', rigid: true, stack: false,
        signature: { kind: 'helm', group: 'Helm', visorGroup: lang.helm === 'trooper' ? 'Visor' : 'Lens', grilleGroup: 'Trim', ...H, pad: r4(H.pad * k * Math.sqrt(bulk)), muzzle: r4(H.muzzle * k * law.focal ** 0.5), flare: r4(H.flare * law.flare / 1.5),
          ...(H.faceplate ? { faceplate: 'Face' } : {}) } }]; },
    cuirass: () => { const out = [], chest = lang.chest ?? 'plain';
      if (chest === 'none') return out;
      // moulded breast and back, split on the midline and open at the sides under the arms (law 8), the abdomen in
      // bands whose gaps are panel lines; `bands` the whole cuirass in wrapped bands, each a little prouder than the one above
      if (chest === 'bands') { const n = 3 + seg; for (let i = 0; i < n; i++) { const a = 1.1 + i * (2.2 / n); out.push(shell({ id: `torso-band${i}`, part: 'torso', side: 'R', s: [r4(a), r4(a + 2.2 / n - 0.05)], t: 'wrap', nt: 16, ns: 1, mugen: mug(0.008 + 0.0015 * i), stack: false })); } }
      else for (const S of ['R', 'L']) {
        out.push(shell({ id: `torso-chest${S}`, part: 'torso', side: S, s: [2.05, 3.3], t: [0, r4(0.37 * Ht)], nt: 7, ns: 4, mugen: mug(0.012), support: 3.3, ramp: r4(0.25 * law.flare) }));
        out.push(shell({ id: `torso-backplate${S}`, part: 'torso', side: S, s: [1.4, 3.3], t: [r4(0.63 * Ht), Ht], nt: 7, ns: 4, mugen: mug(0.01), support: 3.3, ramp: 0.2 }));
        if (chest !== 'plates') for (let i = 0; i < seg + 1; i++) { const a = 1.1 + i * (0.9 / (seg + 1)); out.push(shell({ id: `torso-abs${S}${i}`, part: 'torso', side: S, s: [r4(a), r4(a + 0.9 / (seg + 1) - 0.05)], t: [0, r4(0.3 * Ht)], nt: 5, ns: 1, mugen: mug(0.008) })); }
      }
      const col = lang.collar ?? 'band';
      if (col !== 'none') out.push(shell({ id: 'neck-collar', mode: 'band', part: 'neck', over: ['torso'], pin: [3.95, 0, 'R', 'torso'], s: [0.0, col === 'high' ? 1.15 : 0.7], t: 'wrap', nt: 12, ns: 2, mugen: mug(col === 'high' ? 0.012 : 0.008), support: col === 'high' ? 1.15 : 0.7, ramp: r4((col === 'high' ? 1.2 : 0.8) * law.flare) }));
      // (the BOX: a plate on the chest, a row of lights along its lower edge)
      if (chest === 'box') for (const S of ['R', 'L']) out.push(shell({ id: `torso-box${S}`, part: 'torso', side: S, s: [2.2, 2.75], t: [0, r4(0.13 * Ht)], nt: 4, ns: 2, mugen: mug(0.024), group: 'Trim', stack: false,
        signature: { kind: 'studs', j: 0, count: 3, r: r4(Math.max(minF * 0.6, 0.004 * k)), h: r4(Math.max(minF * 0.4, 0.002 * k)), m: 6, group: 'Reactor' } }));
      if (lang.chest === 'reactor') out.push({ id: 'torso-reactor', mode: 'strap', part: 'torso', path: [[2.62, r4(0.12 * Ht), 'R'], [2.62, 0, 'R'], [2.62, r4(0.12 * Ht), 'L']], width: r4(0.012 * k), thick: r4(thick), mugen: r4(mug(0.012) + thick), rad: r4(0.02 * k), group: 'Plate',
        signature: { kind: 'studs', count: 1, r: r4(0.032 * k * law.focal ** 0.5), h: r4(Math.max(minF, 0.008 * k)), m: 18, rim: 0.6, group: 'Reactor' } });
      return out; },
    pauldron: () => (lang.pauldron === 'none' ? [] : (lang.pauldronSide && lang.pauldronSide !== 'both' ? [lang.pauldronSide] : ['R', 'L'])).flatMap((S) => { const focal = S === focalSide && lang.focal === 'pauldron', v = lang.pauldron ?? 'cap';
      // (LAMES: three stacked down the arm, each prouder than the one above, the shoulder's cap over them)
      if (v === 'lames') return [...[2, 1, 0].map((i) => shell({ id: `upperArm${S}-lame${i}`, part: `upperArm${S}`, side: S, s: [r4(0.02 + i * 0.26), r4(0.4 + i * 0.26)], t: [r4(0.04 * Hl), r4(0.96 * Hl)], nt: 12, ns: 2, mugen: mug(0.007 + 0.003 * i), stack: false, support: r4(0.02 + i * 0.26), ramp: r4(0.4 * law.flare), pin: [3.5, r4(0.5 * Ht), S, 'torso'] })),
        shell({ id: `torso-pauldron${S}`, part: 'torso', over: [`upperArm${S}`], side: S, s: [2.95, 3.85], t: [r4(0.3 * Ht), r4(0.7 * Ht)], nt: 12, ns: 4, mugen: mug(0.009), support: 3.85, ramp: 0.8, rad: r4(0.04 * k) })];
      const big = v === 'dome' ? 1.6 : v === 'segmented' ? 1.1 : 0.8, half = Math.min(0.46, 0.25 * big ** 0.35);
      const out = [];
      if (v !== 'cap') for (let i = (v === 'segmented' ? 2 : 1) - 1; i >= 0; i--) {   // the arm skirt(s), shaped on the arm, pinned to the torso (the arm moves beneath)
        const a = 0.02 + i * 0.32, len = v === 'dome' ? 0.72 * law.focal ** 0.2 : 0.42;
        out.push(shell({ id: `upperArm${S}-pauldron${i}`, part: `upperArm${S}`, side: S, s: [r4(a), r4(a + len)], t: [r4(0.06 * Hl), r4(0.94 * Hl)], nt: 12, ns: 3, mugen: mug(0.006 * big), support: r4(a), ramp: r4(law.flare * big), pin: [3.5, r4(0.5 * Ht), S, 'torso'] })); }
      const anchor = shell({ id: `torso-pauldron${S}`, part: 'torso', over: [`upperArm${S}`], side: S, s: [2.85, 3.85], t: [r4((0.5 - half) * Ht), r4((0.5 + half) * Ht)], nt: 14, ns: 6, mugen: mug(0.008 * big), support: 3.85, ramp: r4(0.6 + 0.3 * big), rad: r4(0.05 * k),
        signature: focal ? { kind: 'facing', dir: [0.85, 0.45, 0.2], r: r4(0.045 * k * law.focal), h: r4(Math.max(minF, 0.01 * k)), m: 16, rim: 0.75, group: 'Emblem' } : quiet() });
      out.push(anchor);
      if (v === 'dome' && orn >= 1) out.push(edgeTrim(anchor, { at: 'low', w: 0.02 * k * law.rivet, thick: thick * 2, group: 'Trim', minF }));   // law 11: the rim takes the trim
      return out; }),
    vambrace: () => { const arms = lang.arms ?? 'panels';
      if (arms === 'none') return [];
      // (MANICA: the sword arm alone, in lames from the shoulder to the wrist, each lower lame overlapping the next)
      if (arms === 'manica') { const S = lang.fnSide ?? 'R', lames = (part, s0, s1, n, m0) => Array.from({ length: n }, (_, i) => { const L = (s1 - s0) / n; return shell({ id: `${part}-manica${i}`, part, s: [r4(s0 + i * L), r4(s0 + (i + 1) * L + 0.06)], t: 'wrap', nt: 12, ns: 1, mugen: mug(m0 + 0.0012 * i), stack: false }); });
        return [...lames(`upperArm${S}`, 0.25, 1.9, 4, 0.006), ...lames(`foreArm${S}`, 0.15, 1.8, 5, 0.006)]; }
      const out = ['R', 'L'].flatMap((S) => panels(`foreArm${S}-vambrace`, `foreArm${S}`, 0.3, 1.8, { t: 'wrap', mugen: mug(0.006), support: 0.3, ramp: r4(0.3 * law.flare) }));
      // (GADGET: a glowing lens set in each vambrace, on its back)
      if (arms === 'gadget') for (const S of ['R', 'L']) out.push(shell({ id: `foreArm${S}-gadget`, part: `foreArm${S}`, side: S, s: [0.9, 1.4], t: [r4(0.3 * Hl), r4(0.7 * Hl)], nt: 4, ns: 2, mugen: mug(0.012), group: 'Trim', stack: false,
        signature: { kind: 'studs', j: -1, count: 2, r: r4(Math.max(minF * 0.6, 0.005 * k)), h: r4(Math.max(minF * 0.4, 0.003 * k)), m: 8, group: 'Lens' } }));
      return out; },
    greave: () => (lang.legs === 'none' ? [] : lang.legs === 'ocrea' ? [lang.leadSide ?? 'L'] : ['R', 'L']).flatMap((S) => [...panels(`shank${S}-greave`, `shank${S}`, 0.15, 1.8, { t: 'wrap', mugen: mug(0.006) }),
      shell({ id: `thigh${S}-knee`, part: `thigh${S}`, over: [`shank${S}`], side: S, s: [3.45, 4.0], t: [0, r4(0.6 * Hth)], nt: 8, ns: 2, mugen: mug(0.01), support: 3.45, ramp: r4(0.6 * law.flare) }),
      // law 8 on converged legs (the structured core: the knees a few cm apart) the inner knee plate turns less far in
      shell({ id: `thigh${S}-kneeM`, part: `thigh${S}`, over: [`shank${S}`], side: other(S), s: [3.45, 4.0], t: [0, r4((ctx.pelvis ? 0.3 : 0.45) * Hth)], nt: 6, ns: 2, mugen: mug(0.01), support: 3.45, ramp: r4(0.6 * law.flare) })]),
    boot: () => ['R', 'L'].map((S) => shell({ id: `foot${S}-boot`, part: `foot${S}`, over: [`toes${S}`], s: [0.3, 2.0], t: 'wrap', nt: 10, ns: 3, mugen: mug(0.007) })),
    belt: () => [shell({ id: 'torso-belt', part: 'torso', over: ['thighR', 'thighL'], pin: [0.8, 0, 'R', 'torso'], s: [0.55, 1.0], t: 'wrap', nt: 16, ns: 1, mugen: mug(0.009), group: 'Trim', signature: { kind: 'studs', j: 0, count: 1, r: r4(0.02 * k), h: r4(Math.max(minF, 0.006 * k)), m: 12, group: 'Trim' } })],
    // law 8: the thigh plates cover the front and outside; the inner thigh stays bodysuit
    thigh: () => (['greaves', 'ocrea', 'none'].includes(lang.legs) ? [] : ['R', 'L'].flatMap((S) => panels(`thigh${S}-cuisse`, `thigh${S}`, 1.6, 3.35, { side: S, t: [0, r4(0.72 * Hth)], nt: 8, mugen: mug(0.008) }))),
    // the SKIRT under the belt: `pteruges` strips hanging all round (each a board on an anchor band), `tassets` a plate
    // over each hip, pinned to the waist so the leg moves beneath
    skirt: () => { const v = lang.skirt ?? 'none';
      if (v === 'pteruges') return ['R', 'L'].flatMap((S) => [0, 1, 2, 3].map((q) => { const t0 = (0.02 + q * 0.245) * Ht, t1 = t0 + 0.22 * Ht;
        return { id: `torso-pteryx${S}${q}`, mode: 'shell', part: 'torso', side: S, s: [0.35, 0.62], t: [r4(t0), r4(t1)], nt: 6, ns: 2, mugen: mug(0.012), thick, rad: r4(0.01 * k), group: 'Trim', rigid: true, stack: false, pin: [0.5, r4((t0 + t1) / 2), S, 'torso'],
          signature: { kind: 'boards', group: 'Trim', cordGroup: 'Trim', bottom: 'j0', n: 1, len: r4(0.2 * k), stand: r4(0.006 * k), dm: 0, tilt: r4(thick * 1.5), thick, bow: r4(0.006 * k), widen: 0, cords: 0 } }; }));
      if (v === 'tassets') return ['R', 'L'].map((S) => shell({ id: `thigh${S}-tasset`, part: `thigh${S}`, side: S, s: [0.35, 1.45], t: [0, r4(0.75 * Hth)], nt: 8, ns: 2, mugen: mug(0.016), stack: false, pin: [0.6, r4(0.2 * Ht), S, 'torso'], support: 0.35, ramp: r4(0.6 * law.flare) }));
      return []; },
    // GLOW LINES: a glowing strip down each forearm and shin (the cyborg's), riding the plates
    glow: () => (lang.glow === 'lines' ? ['R', 'L'].flatMap((S) => [[`foreArm${S}`, 0.4, 1.7], [`shank${S}`, 0.3, 1.7]].map(([part, a, b]) => ({ id: `${part}-glow`, mode: 'strap', part, path: [[a, r4(0.5 * Hl), S], [r4((a + b) / 2), r4(0.5 * Hl), S], [b, r4(0.5 * Hl), S]],
      width: r4(0.006 * k), thick: r4(minF), mugen: r4(mug(0.006) + thick * 1.6), rad: r4(0.004 * k), group: 'Lens', stack: false, signature: quiet('Lens') }))) : []),
    upperArm: () => ['R', 'L'].flatMap((S) => [...panels(`upperArm${S}-rerebrace`, `upperArm${S}`, 0.95, 1.7, { t: 'wrap', mugen: mug(0.005) }),
      shell({ id: `upperArm${S}-elbow`, part: `upperArm${S}`, over: [`foreArm${S}`], side: S, s: [1.65, 2.0], t: [r4(0.5 * Hl), r4(1.0 * Hl)], nt: 8, ns: 2, mugen: mug(0.008), support: 1.65, ramp: r4(0.5 * law.flare) })]),
    gauntlet: () => ['R', 'L'].map((S) => shell({ id: `hand${S}-gauntlet`, part: `hand${S}`, s: [0.3, 1.35], t: 'wrap', nt: 10, ns: 2, mugen: mug(0.005) })),
    pack: () => lang.pack === 'jet' ? [{ id: 'torso-packmount', mode: 'band', part: 'torso', s: [2.2, 2.9], t: 'wrap', nt: 12, ns: 1, mugen: 0.001, thick: r4(minF), rad: r4(0.01 * k), group: 'Suit', rigid: true, stack: false,
      signature: { kind: 'pack', group: 'Plate', w: r4(0.24 * k), h: r4(0.3 * k), d: r4(0.09 * k), lift: r4(mug(0.012) + thick), vents: 2, ventR: r4(0.04 * k), ventH: r4(0.07 * k), ventGroup: 'Trim' } }]
      : lang.pack === 'power' ? [{ id: 'torso-packmount', mode: 'band', part: 'torso', s: [2.2, 2.9], t: 'wrap', nt: 12, ns: 1, mugen: 0.001, thick: r4(minF), rad: r4(0.01 * k), group: 'Suit', rigid: true, stack: false,
      signature: { kind: 'pack', group: 'Plate', w: r4(0.3 * k * Math.sqrt(bulk)), h: r4(0.36 * k * Math.sqrt(bulk)), d: r4(0.1 * k * bulk), lift: r4(mug(0.012) + thick), vents: 2, ventR: r4(0.026 * k * Math.sqrt(bulk)), ventH: r4(0.12 * k * law.focal ** 0.5), ventGroup: 'Trim' } }] : [],
  };
  const kit = [];
  for (const [th, piece] of HARDSUIT_ORDER) if (c >= th - 1e-9 && (!ctx.keep || ctx.keep.includes(piece))) { const e = PIECES[piece](); if (e.length) { trace.worn.push(piece); kit.push(...e); } }
  return { kit, trace: { ...trace, pieces: trace.worn.length, focal: lang.focal ?? 'helm', segments: seg } };
}
