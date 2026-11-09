/**
 * THE MATTER ANSWERING — what a round does to what it strikes (terminal ballistics), seen as it is: a hole, a breach, a
 * spall, a dent, a crater, a scorch. Computed from the round's own numbers (ordnance.js) and the matter's (rupa/matter.js),
 * drawn plausibly; nothing breaks physically (the operator's steer: a visual depiction with reasonable plausibility). Pure.
 *
 *   strike(word, { v, obliquity? }, target)  → { perforated, depth, effect, hole?, crater?, … } for one round arriving at
 *                                             `v` m/s onto a target { matter, thickness (m), angle? (° off its normal) }
 *   STANDS                                   the range's targets: plates of armour at thicknesses and one sloped, mild
 *                                             steel, reinforced and plain concrete, brick, stone, timber, sandbags, earth
 *   measureTerminal(word, flight)            → each stand at each of the round's bands (`flight`: measureOrdnance's)
 *   terminalLaws(byWord)                     → [{ name, ok, info }]
 *
 * THE LAWS OF IT, by what the round is:
 *   kinetic   a long rod erodes as it goes: P = L · A · √(ρp / ρt) · e^(−K·σt / (ρp·v²)) (a simplified Lanz–Odermatt: its
 *             length, the densities, the target's strength against the rod's dynamic pressure), A and K calibrated so a
 *             modern 120 mm rod cuts about 650 mm of rolled armour at the muzzle and 600 mm at 2 km. A plate at an angle is
 *             its thickness over the angle's cosine. Through: a hole a little wider than the rod (a masonry face spalls a
 *             cone round it); short: a dent or a spall as deep as it went.
 *   shaped    a jet cuts the same depth at any range: its armour figure scaled by √(ρ_RHA / ρt) (a jet's hydrodynamic
 *             penetration), a narrow hole; its filler scorches the face.
 *   blast     an explosive's energy (its filler, 4.184 MJ/kg) coupled into what it lies against (a quarter of it): a metal
 *             plate is holed only when thin for it (petalled), else scorched; a wall of masonry or wood is breached when
 *             its filler is the engineers' breaching charge for the wall (FM 5-250: t³ · K · C, by its material, untamped),
 *             else its face spalls; earth craters by its dig energy (a bowl two and a half times as wide as deep), and a
 *             sandbag wall the crater cuts through is breached; a rod or a jet goes through one by its penetration.
 *   Any round onto earth digs a crater: a blast's energy, or a tenth of a kinetic round's.
 * Magnitudes by class, never one maker's tables; the eyes gate is the operator's.
 */
import { MATTER } from '../../rupa/matter.js';
import { ORDNANCE } from './ordnance.js';

/**
 * The law as an import-free kernel (the page carries it by toString(), so a shell's mark on the range is the same law
 * the measures run): `terminalKernel(ORD, MAT)` over a round table and a matter table → { strike, penetration,
 * breachCharge }.
 */
export function terminalKernel(ORDNANCE, MATTER) {
  const RHA = MATTER['armour-steel'] || { density: 7850 }, TNT = 4.184e6, COUPLE = 0.25, KINETIC_DIG = 0.1;
  // the long rod's law, calibrated (A, K): 650 mm of RHA at 1650 m/s, 600 mm at 1542 m/s for a 0.57 m tungsten rod
  const A = 1.33, K = 28;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const strength = (m) => m.yield ?? m.compressive;
  // a blast's energy density to spall masonry or wood: its crushing strength, stiffened by its toughness (rebar holds a
  // reinforced wall together); wood splinters along its grain at a third of its strength
  const breachDensity = (m) => (m.family === 'wood' ? strength(m) * 0.3 : strength(m) * (1 + m.toughness / 1e6));
  // THE BREACH: the engineers' breaching formula (FM 5-250), the charge (kg TNT) that opens a wall of thickness t (m):
  // W = 0.4536 · (t / 0.3048)³ · K · C, K the material's (ordinary masonry and timber 0.23, first-class masonry and
  // concrete 0.35, reinforced concrete 0.70), C the placing's (an untamped charge on its face: 3.6)
  const BREACH_K = { 'reinforced-concrete': 0.7, concrete: 0.35, stone: 0.35, sandstone: 0.35, brick: 0.23, adobe: 0.23, ceramic: 0.23, timber: 0.23, pine: 0.23, drywall: 0.1 };
  const UNTAMPED = 3.6;
  const breachCharge = (matter, t) => 0.4536 * (t / 0.3048) ** 3 * (BREACH_K[matter] ?? 0.35) * UNTAMPED;
  // a crater's bowl from its volume: a paraboloid two and a half times as wide as deep
  const bowl = (V) => { const r = Math.cbrt((5 * V) / Math.PI); return { r: r3(r), depth: r3(r / 2.5) }; };
  // penetration (m) of a round into a matter, at v
  function penetration(word, matter, v) {
    const O = ORDNANCE[word], M = MATTER[matter];
    if (O.rod) return O.rod.length * A * Math.sqrt(O.rod.density / M.density) * Math.exp(-K * strength(M) / (O.rod.density * v * v));
    if (O.jet) return O.jet.rha * Math.sqrt(RHA.density / M.density);
    return 0;
  }
  function strike(word, { v, obliquity = 0 }, target) {
    const O = ORDNANCE[word], M = MATTER[target.matter];
    if (!O) throw new Error(`strike: no ordnance '${word}'`);
    if (!M) throw new Error(`strike: no matter '${target.matter}'`);
    const angle = Math.min(80, Math.abs((target.angle ?? 0) + obliquity)), t = target.thickness ?? Infinity;
    const eff = Number.isFinite(t) ? t / Math.cos(angle * Math.PI / 180) : Infinity;
    const blast = O.filler * TNT * COUPLE, soil = M.family === 'soil';
    // earth: a crater by the round's energy (a blast's, a tenth of a kinetic one's), the sandbag wall it cuts through
    if (soil && (O.rod || O.jet) && Number.isFinite(t)) {
      // (a rod or a jet through a wall of earth: it goes by its penetration in it, a small hole and a spray)
      const P = penetration(word, target.matter, v);
      if (P >= eff) return { matter: target.matter, thickness: t, effective: r3(eff), penetration: r3(P), perforated: true, depth: r3(eff), effect: 'hole', hole: 0.1, residual: r3(P - eff) };
    }
    if (soil) {
      const E = blast + (O.rod ? KINETIC_DIG * 0.5 * O.mass * v * v : 0), c = bowl(E / M.dig);
      const through = Number.isFinite(t) && c.depth * 2 >= t;
      return { matter: target.matter, thickness: t, perforated: through, depth: r3(Math.min(c.depth, t)), effect: through ? 'breach' : 'crater', crater: c, ...(through ? { hole: c.r } : {}) };
    }
    if (O.rod || O.jet) {
      const P = penetration(word, target.matter, v), through = P >= eff, wide = M.family === 'metal' ? 1 : 4;
      const hole = O.rod ? r3(O.rod.diameter * 0.75 * wide) : r3(0.02 * wide);
      return { matter: target.matter, thickness: t, effective: r3(eff), penetration: r3(P), perforated: through, depth: r3(Math.min(P, eff)),
        effect: through ? 'hole' : M.family === 'metal' ? 'dent' : 'spall', hole, ...(through ? { residual: r3(P - eff) } : {}), ...(O.jet && O.filler ? { scorch: r3(0.15 * Math.cbrt(O.filler)) } : {}) };
    }
    // a blast: a thin plate holed and petalled, a thick one scorched
    if (M.family === 'metal') {
      const most = 0.02 * Math.cbrt(O.filler) * Math.sqrt(235e6 / strength(M)), through = eff <= most;
      return { matter: target.matter, thickness: t, perforated: through, depth: r3(Math.min(eff, most)), effect: through ? 'hole' : 'scorch', limit: r3(most), ...(through ? { hole: r3(0.15 * Math.cbrt(O.filler)) } : { scorch: r3(0.3 * Math.cbrt(O.filler)) }) };
    }
    // masonry or wood: breached when its filler is the breaching charge for the wall's thickness, the hole the breaching
    // radius (the thickness) grown by how far over it is; else its face spalled, a cone its energy digs
    const need = Number.isFinite(eff) ? breachCharge(target.matter, eff) : Infinity;
    if (O.filler >= need) return { matter: target.matter, thickness: t, perforated: true, depth: r3(eff), effect: 'breach', hole: r3(Math.min(1, eff * Math.cbrt(O.filler / need))), charge: r3(need) };
    const r = Math.cbrt((6 * blast / breachDensity(M)) / Math.PI);
    return { matter: target.matter, thickness: t, perforated: false, depth: r3(Math.min(eff, r / 2)), effect: 'spall', crater: { r: r3(r), depth: r3(Math.min(eff, r / 2)) }, ...(Number.isFinite(need) ? { charge: r3(need) } : {}) };
  }
  return { strike, penetration, breachCharge };
}

const K0 = terminalKernel(ORDNANCE, MATTER);
/** Penetration (m) of a round into a matter, at `v`. */
export const penetration = K0.penetration;
/** The charge (kg TNT) that breaches a wall of a matter at a thickness (FM 5-250, untamped). */
export const breachCharge = K0.breachCharge;
export const strike = K0.strike;

// the range's targets, each a matter at a thickness (m), one sloped
export const STANDS = Object.freeze([
  { id: 'rha-100', matter: 'armour-steel', thickness: 0.1 },
  { id: 'rha-300', matter: 'armour-steel', thickness: 0.3 },
  { id: 'rha-300-sloped', matter: 'armour-steel', thickness: 0.3, angle: 60 },
  { id: 'rha-500', matter: 'armour-steel', thickness: 0.5 },
  { id: 'rha-700', matter: 'armour-steel', thickness: 0.7 },
  { id: 'steel-25', matter: 'steel', thickness: 0.025 },
  { id: 'rc-500', matter: 'reinforced-concrete', thickness: 0.5 },
  { id: 'rc-1000', matter: 'reinforced-concrete', thickness: 1 },
  { id: 'concrete-300', matter: 'concrete', thickness: 0.3 },
  { id: 'brick-250', matter: 'brick', thickness: 0.25 },
  { id: 'stone-500', matter: 'stone', thickness: 0.5 },
  { id: 'timber-200', matter: 'timber', thickness: 0.2 },
  { id: 'sandbags-600', matter: 'sand', thickness: 0.6 },
  { id: 'earth', matter: 'loam' },
].map((s) => Object.freeze(s)));

/** Each stand at each of the round's bands: its speed there (`flight`, measureOrdnance's), the indirect shell from above. */
export function measureTerminal(word, flight) {
  const O = ORDNANCE[word], out = { ordnance: word, kind: O.kind, bands: {} };
  for (const [d, b] of Object.entries(flight.bands)) {
    // (a direct round strikes a stand's face square; an indirect one falls onto it, its obliquity off the face's normal
    // what its fall leaves: a wall's face takes it glancing, earth takes it square)
    out.bands[d] = Object.fromEntries(STANDS.map((s) => [s.id, strike(word, { v: b.v, obliquity: O.indirect && s.thickness !== undefined && MATTER[s.matter].family !== 'soil' ? 90 - b.fall : 0 }, s)]));
  }
  return out;
}

/** The matter's laws (`byWord`: { <ordnance>: measureTerminal(...) }). */
export function terminalLaws(byWord) {
  const L = [], law = (name, ok, info) => L.push({ name, ok: !!ok, ...(info !== undefined ? { info } : {}) });
  const plates = STANDS.filter((s) => s.matter === 'armour-steel' && !s.angle).sort((a, b) => a.thickness - b.thickness);
  for (const [w, m] of Object.entries(byWord)) {
    const O = ORDNANCE[w], ds = Object.keys(m.bands).map(Number);
    // a thicker plate never lets through what a thinner one stopped
    law(`${w}: a thicker plate stops what a thinner one stopped`, ds.every((d) => plates.every((p, i) => i === 0 || !m.bands[d][p.id].perforated || m.bands[d][plates[i - 1].id].perforated)), Object.fromEntries(ds.map((d) => [d, plates.map((p) => (m.bands[d][p.id].perforated ? 1 : 0)).join('')])));
    if (O.rod) {
      const P = ds.map((d) => m.bands[d]['rha-100'].penetration);
      law(`${w}: a long rod cuts less the farther it flies (it slows)`, P.every((p, i) => i === 0 || p < P[i - 1]), Object.fromEntries(ds.map((d, i) => [d, P[i]])));
      law(`${w}: about 650 mm of rolled armour near the muzzle, 600 at 2 km`, Math.abs(m.bands[ds[0]]['rha-100'].penetration - 0.65) < 0.03 && (!m.bands[2000] || Math.abs(m.bands[2000]['rha-100'].penetration - 0.6) < 0.03), Object.fromEntries(ds.map((d, i) => [d, P[i]])));
      law(`${w}: a plate at 60° resists as twice its thickness`, ds.every((d) => Math.abs(m.bands[d]['rha-300-sloped'].effective - 0.6) < 1e-3), m.bands[ds[0]]['rha-300-sloped']);
      law(`${w}: it cuts deeper into concrete than into armour`, ds.every((d) => m.bands[d]['concrete-300'].penetration > m.bands[d]['rha-100'].penetration), null);
      law(`${w}: it passes through a sandbag wall`, ds.every((d) => m.bands[d]['sandbags-600'].effect === 'hole'), null);
    }
    if (O.jet) {
      const P = ds.map((d) => m.bands[d]['rha-100'].penetration);
      law(`${w}: a shaped charge cuts the same at any range`, P.every((p) => Math.abs(p - P[0]) < 1e-9), P);
    }
    if (!O.rod && !O.jet) {
      law(`${w}: a blast never holes thick armour`, ds.every((d) => !m.bands[d]['rha-100'].perforated), null);
      law(`${w}: it craters earth and breaches a brick wall`, ds.every((d) => m.bands[d].earth.effect === 'crater' && (O.indirect || m.bands[d]['brick-250'].effect === 'breach')), null);
      law(`${w}: reinforced concrete holds better than plain`, ds.every((d) => (m.bands[d]['rc-500'].hole ?? 0) <= (m.bands[d]['concrete-300'].hole ?? 0)), null);
      law(`${w}: a shell does not breach a metre of reinforced concrete`, ds.every((d) => !m.bands[d]['rc-1000'].perforated), null);
    }
  }
  // between rounds: the blast's crater grows with its filler
  const blasts = Object.keys(byWord).filter((w) => !ORDNANCE[w].rod && !ORDNANCE[w].jet).sort((a, b) => ORDNANCE[a].filler - ORDNANCE[b].filler);
  if (blasts.length > 1) {
    const c = blasts.map((w) => Object.values(byWord[w].bands)[0].earth.crater.r);
    law('the more filler, the wider the crater', c.every((r, i) => i === 0 || r > c[i - 1]), Object.fromEntries(blasts.map((w, i) => [w, c[i]])));
  }
  return L;
}
