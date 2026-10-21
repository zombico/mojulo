// footwear/expand — a footwear CARD (styles.js) worn on a body through its FOOT ADAPTER (adapters/), by the passes in a
// fixed order (principles.js carries the laws):
//
//   1 SOCK   the protosock: the body's own close upper at the card's height and thickness (none: a sandal, worn on the
//            bare foot)
//   2 SOLE   per side, under the foot and under the toes (split at the toe base): its LAYERS stacked from the floor up
//            (the outsole, a midsole, a stripe …), each the footprint's outline grown by its own welt, in its own group; a
//            layer's `pod` a window of another group at the heel, proud of the layer's wall (an air sole)
//   3 ADORN  per side, the card's primitives in order (ADORN_PRIMS), each on the layer under it, carried by its weights;
//            a `panel` on a cobbler region (cobbler.js: the tongue, the eyestays, the quarters, the counter …)
//   4 TONE   the colours of the groups laid, the card's own over FOOTWEAR_TONES, its skin's (a colourway) over those; a
//            tone OF another group stays so, for the palette it lands in to read (readTones)
//
// Parts are layer 1, named `<id>_<segment>` (the sock), `<id>Sole_<segment>`, `<id>Strap<k>_<segment>` and
// `<id>Buckle<k>_<segment>` (k counting the straps), `<id>Sole<i>_…` for a sole's layers past the first, `<id>Pod<i>_…`, `<id>Band<k>_…`, `<id>Cuff_…`, `<id>ToeCap_…`, `<id>Rivet<k>_…`, a panel
// `<id><Region><Lat|Med>_…` (an inline region's `<id>Panel<k>…`), `<id>Lace<k>_…`.
// Pure and deterministic: no dice, fixed order.
import { soleSlab, strapBand, buckleOn, bindNearest, quarterEgg, tuckUnderEgg, studsOn, pointsOf, unitv } from './parts.js';
import { FOOTWEAR, FOOTWEAR_TONES, SKINS } from './styles.js';
import { COBBLER_REGIONS, REGION_SIDES, arcOf, panelOn, laceBars } from './cobbler.js';

/** THE ADORNMENT PRIMITIVES: each one's keys, its group, and what it is */
export const ADORN_PRIMS = Object.freeze({
  strap: { keys: ['on', 'at', 'width', 'lift', 'buckle', 'group'], group: 'Strap', what: 'a band round the sock (or the bare foot) at a share, a buckle on its outer side' },
  band: { keys: ['on', 'at', 'width', 'lift', 'group'], group: 'Gilt', what: 'a thin ring of gilding at a share' },
  cuff: { keys: ['width', 'lift', 'group'], group: 'Cuff', what: "a turned band at the sock's collar" },
  panel: { keys: ['region', 'on', 'lift', 'thick', 'rise', 'group'], group: 'Overlay', what: 'a pattern piece laid over the sock on a cobbler region (cobbler.js COBBLER_REGIONS: tongue, eyestay, quarter …, or { along, around, sides }), a matching pair on both sides where the region has two' },
  laces: { keys: ['rows', 'lift', 'w', 'group'], group: 'Lace', what: "criss-cross laces between the eyestays' inner edges, over the tongue" },
  toeCap: { keys: ['lift', 'room', 'rivets', 'stud', 'group'], group: 'Steel', what: 'a quarter egg over the toes, toe base to tip (the half teacup), rivets round its back edge (`stud`: { size, group }, small and dark: broguing)' },
});
/** the families a card is annotated with (what kind of footwear it is: a shelf to browse, a word to ask by) */
export const FOOTWEAR_FAMILIES = Object.freeze(['shoe', 'boot', 'sandal', 'sneaker', 'dress']);
/** a sole layer's PATTERNS: `pod` a window of another group at the heel, `from` … `to` shares of the foot's print from
 * the heel, proud of the layer's wall (an air sole); `heel` a block under the print's rear (`to` of it from the heel),
 * `thick` tall from the layer's floor (a dress heel, the foot still flat); `lugs` tread blocks round the layer's edge,
 * every `every`-th point of its outline, `size` (m) */
export const SOLE_PATTERNS = Object.freeze({ pod: ['from', 'to', 'welt', 'group'], heel: ['to', 'thick', 'group'], lugs: ['every', 'size', 'group'] });
const GROUP = /^[A-Z][A-Za-z0-9]*$/;
/** a tone: '#rrggbb', or { of: <group>, shade } (that group's colour darkened (−) or lightened (+)) */
const isTone = (c) => (typeof c === 'string' ? /^#[0-9a-f]{6}$/i.test(c) : !!c && typeof c === 'object' && GROUP.test(c.of ?? '') && c.shade >= -1 && c.shade <= 1 && Object.keys(c).length === 2);
/** A palette with its tones OF other groups read (each that group's colour, darkened or lightened; a group it names
 * missing, a mid grey): '#rrggbb' throughout */
export function readTones(palette) {
  const out = { ...palette }, hex = (g, depth = 0) => {
    const c = out[g]; if (typeof c === 'string') return c;
    if (!c || depth > 4) return '#808080';
    const base = hex(c.of, depth + 1), rgb = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
    const v = rgb.map((x) => Math.round(c.shade < 0 ? x * (1 + c.shade) : x + (255 - x) * c.shade));
    return (out[g] = `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`);
  };
  for (const g of Object.keys(out)) hex(g);
  return out;
}
/** each named pattern piece's group (an inline region's is Overlay) */
const PANEL_GROUPS = { tongue: 'Tongue', eyestay: 'Eyestay', quarter: 'Overlay', vamp: 'Overlay', counter: 'Counter', foxing: 'Overlay' };
const SEGS = ['foot', 'shank'], share = (x) => typeof x === 'number' && x >= 0 && x <= 1;

/** a word or a card of one's own → the card, resolved: `from` a card it extends (its sock merged, its sole, adorn and
 * family replaced where given, `adornPlus` appended to the adornment, its tones merged), then its `skin` (a colourway,
 * styles.js SKINS) over the tones */
export function footwearCard(spec, depth = 0) {
  const C = typeof spec === 'string' ? FOOTWEAR[spec] : spec;
  if (!C || typeof C !== 'object' || depth > 4) return C;
  const B = C.from !== undefined ? footwearCard(C.from, depth + 1) : null;
  const { from: _f, skin, adornPlus, ...own } = C;
  const out = B ? { ...B, ...own, sock: own.sock === false ? false : own.sock === undefined ? B.sock : B.sock ? { ...B.sock, ...own.sock } : own.sock,
    tones: { ...(B.tones || {}), ...(own.tones || {}) } } : { ...own };
  if (adornPlus) out.adorn = [...(out.adorn || []), ...adornPlus];
  if (skin !== undefined) out.tones = { ...(out.tones || {}), ...(typeof skin === 'string' ? SKINS[skin] : skin) };
  if (out.tones && !Object.keys(out.tones).length) delete out.tones;
  return out;
}

/** Error strings for a card (a word: is it one), by name */
export function validateFootwear(spec, label = 'footwear') {
  if (typeof spec === 'string') return Object.hasOwn(FOOTWEAR, spec) ? [] : [`${label}: '${spec}' is not a footwear word (${Object.keys(FOOTWEAR).join(', ')}), or give a card { sock, sole, adorn }`];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a word or a card { sock, sole, adorn }`];
  const pre = [];
  if (spec.from !== undefined && !(typeof spec.from === 'string' ? Object.hasOwn(FOOTWEAR, spec.from) : spec.from && typeof spec.from === 'object')) pre.push(`${label}.from: a footwear word (${Object.keys(FOOTWEAR).join(', ')}) or a card`);
  if (spec.skin !== undefined && !(typeof spec.skin === 'string' ? Object.hasOwn(SKINS, spec.skin) : spec.skin && typeof spec.skin === 'object' && !Array.isArray(spec.skin))) pre.push(`${label}.skin: a colourway (${Object.keys(SKINS).join(', ')}) or { <group>: '#rrggbb' }`);
  if (spec.adornPlus !== undefined && !Array.isArray(spec.adornPlus)) pre.push(`${label}.adornPlus: a list of { prim, … }, laid after the adornment`);
  for (const k of Object.keys(spec)) if (!['family', 'sock', 'sole', 'adorn', 'adornPlus', 'tones', 'from', 'skin'].includes(k)) pre.push(`${label}: a card takes family, sock, sole, adorn, adornPlus, tones, from, skin, not '${k}'`);
  if (pre.length) return pre;
  if (spec.from !== undefined || spec.skin !== undefined || spec.adornPlus !== undefined) {
    const sub = typeof spec.from === 'object' ? validateFootwear(spec.from, `${label}.from`) : [];
    if (sub.length) return sub;
    const tones = typeof spec.skin === 'object' ? Object.entries(spec.skin).filter(([, c]) => !isTone(c)).map(([g]) => `${label}.skin.${g}: '#rrggbb', or { of, shade }`) : [];
    const { skin: _s, ...rest } = footwearCard(spec);
    return [...tones, ...validateFootwear(rest, label)];
  }
  const errs = [], { sock, sole, adorn = [] } = spec;
  if (spec.family !== undefined && !FOOTWEAR_FAMILIES.includes(spec.family)) errs.push(`${label}.family: one of ${FOOTWEAR_FAMILIES.join(', ')}`);
  if (sock !== false && sock !== undefined) {
    if (!['shoe', 'boot'].includes(sock?.height)) errs.push(`${label}.sock.height: 'shoe' or 'boot' (or sock: false, a sandal)`);
    for (const k of ['collar', 'shaft']) if (sock?.[k] !== undefined && !share(sock[k])) errs.push(`${label}.sock.${k}: a share, 0 to 1`);
    if (sock?.thick !== undefined && !(sock.thick > 0 && sock.thick <= 0.03)) errs.push(`${label}.sock.thick: metres, over 0 and at most 0.03`);
  }
  const metres = (v) => v === undefined || (v >= 0 && v <= 0.1);
  if (sole?.layers !== undefined) {
    if (!Array.isArray(sole.layers) || !sole.layers.length) errs.push(`${label}.sole.layers: a list of { thick, welt?, group?, pod? }, the floor's first`);
    else sole.layers.forEach((L, i) => {
      const at = `${label}.sole.layers[${i}]`;
      if (!(L?.thick > 0 && L.thick <= 0.1)) errs.push(`${at}.thick: metres, over 0 and at most 0.1`);
      if (!metres(L?.welt)) errs.push(`${at}.welt: metres, 0 to 0.1`);
      if (L?.group !== undefined && !GROUP.test(L.group)) errs.push(`${at}.group: a group name (Sole, Midsole …)`);
      for (const k of Object.keys(L || {})) if (!['thick', 'welt', 'group', ...Object.keys(SOLE_PATTERNS)].includes(k)) errs.push(`${at}: a layer takes thick, welt, group, ${Object.keys(SOLE_PATTERNS).join(', ')}, not '${k}'`);
      for (const pat of Object.keys(SOLE_PATTERNS)) if (L?.[pat] !== undefined) {
        const P = L[pat];
        if (!P || typeof P !== 'object') { errs.push(`${at}.${pat}: { ${SOLE_PATTERNS[pat].join(', ')} }`); continue; }
        for (const k of ['from', 'to']) if (P[k] !== undefined && !share(P[k])) errs.push(`${at}.${pat}.${k}: a share, 0 to 1`);
        for (const k of ['thick', 'size']) if (P[k] !== undefined && !(P[k] > 0 && P[k] <= 0.1)) errs.push(`${at}.${pat}.${k}: metres, over 0 and at most 0.1`);
        if (P.every !== undefined && !(Number.isInteger(P.every) && P.every >= 1)) errs.push(`${at}.${pat}.every: a whole number, 1 or more`);
        if (P.group !== undefined && !GROUP.test(P.group)) errs.push(`${at}.${pat}.group: a group name`);
        for (const k of Object.keys(P)) if (!SOLE_PATTERNS[pat].includes(k)) errs.push(`${at}.${pat}: takes ${SOLE_PATTERNS[pat].join(', ')}, not '${k}'`);
      }
    });
    if (sole.thick !== undefined || sole.welt !== undefined) errs.push(`${label}.sole: layers, or thick and welt (one layer), not both`);
  } else if (sole !== undefined) for (const k of ['thick', 'welt']) if (!metres(sole?.[k])) errs.push(`${label}.sole.${k}: metres, 0 to 0.1`);
  if (!Array.isArray(adorn)) errs.push(`${label}.adorn: a list of { prim, … }`);
  else adorn.forEach((a, i) => {
    const P = ADORN_PRIMS[a?.prim], at = `${label}.adorn[${i}]`;
    if (!P) { errs.push(`${at}.prim: one of ${Object.keys(ADORN_PRIMS).join(', ')}`); return; }
    for (const k of Object.keys(a)) if (k !== 'prim' && !P.keys.includes(k)) errs.push(`${at}: ${a.prim} takes ${P.keys.join(', ')}, not '${k}'`);
    if (P.keys.includes('on') && a.prim !== 'panel' && !SEGS.includes(a.on)) errs.push(`${at}.on: ${SEGS.join(' or ')}`);
    for (const k of ['at']) if (a[k] !== undefined && !share(a[k])) errs.push(`${at}.${k}: a share, 0 to 1`);
    if (a.prim === 'panel') {
      const R = a.region;
      if (typeof R === 'string') { if (!COBBLER_REGIONS[R]) errs.push(`${at}.region: one of ${Object.keys(COBBLER_REGIONS).join(', ')}, or { along, around, sides }`); }
      else if (!R || ![R.along, R.around].every((x) => Array.isArray(x) && x.length === 2 && x.every(share) && x[0] <= x[1]) || !REGION_SIDES.includes(R.sides)) errs.push(`${at}.region: a cobbler region's name, or { along: [a0, a1], around: [r0, r1] (shares), sides: ${REGION_SIDES.join(' | ')} }`);
      if (a.on !== undefined && !SEGS.includes(a.on)) errs.push(`${at}.on: ${SEGS.join(' or ')}`);
    }
    if (a.group !== undefined && !GROUP.test(a.group)) errs.push(`${at}.group: a group name (Steel, Gilt …)`);
    if (['cuff', 'toeCap', 'panel', 'laces'].includes(a.prim) && sock === false) errs.push(`${at}: a ${a.prim} is worn on the sock; this card has none`);
  });
  for (const [g, c] of Object.entries(spec.tones || {})) if (!isTone(c)) errs.push(`${label}.tones.${g}: '#rrggbb', or { of: <group>, shade: −1 … 1 } (that group's colour darkened or lightened)`);
  return errs;
}

/** The footwear on a body (see the head of this file). */
export function wearFootwear(A, spec = 'boots', { id = 'boots', group = 'Shoes' } = {}) {
  const errs = validateFootwear(spec), C = footwearCard(spec);
  if (errs.length) throw new Error(errs.join('; '));
  const sock = C.sock || null, used = new Set();
  // (the sole's layers from the floor up; `{ thick, welt }` is one)
  const layers = C.sole?.layers ?? [{ thick: C.sole?.thick ?? 0.008, welt: C.sole?.welt ?? 0.003 }], soleThick = layers.reduce((t, L) => t + L.thick, 0);
  // 1 SOCK (none: the sole and the straps on the bare foot, the skin's own parts)
  const parts = sock ? A.upper(sock, { id, group }) : {};
  const on = (seg) => (seg ? (sock ? parts[`${id}_${seg}`] : A.bare(seg)) : undefined);
  const put = (name, part) => { parts[name] = part; used.add(part.group); };
  // (the sock's collar: its top ring's share, a boot's up the shank, a shoe's on the foot)
  const collar = sock && (sock.height === 'boot' ? { on: 'shank', at: 1 - (sock.shaft ?? 0.3) } : { on: 'foot', at: sock.collar ?? 0.15 });
  for (const S of A.sides) {
    const fn = A.seg('foot', S), tn = A.seg('toes', S), foot = on(fn), toes = on(tn);
    if (!foot) continue;
    // 2 SOLE: each segment's footprint behind or in front of the toe base (a few millimetres over it), grown by the welt
    const { toeBase: tb, toeTip: tt } = A.joints(S), fwd = tb && tt ? unitv([tt[0] - tb[0], tt[1] - tb[1], 0]) : [0, 1, 0];
    const ahead = (p) => (tb ? (p[0] - tb[0]) * fwd[0] + (p[1] - tb[1]) * fwd[1] : 0);
    const floor = Math.min(...[foot, toes].filter(Boolean).flatMap(pointsOf).map((p) => p[2]));
    const n = { strap: 0, band: 0, rivet: 0, panel: 0, lace: 0, lug: 0 };
    for (const [seg, P, keep] of [[fn, foot, (p) => ahead(p) < 0.004], [tn, toes, (p) => ahead(p) > -0.004]]) {
      if (!P) continue;
      const print = pointsOf(P).filter((p) => p[2] < floor + Math.max(0.015, soleThick + 0.008) && keep(p));
      let z = floor;
      layers.forEach((L, i) => {
        const welt = L.welt ?? 0.003, slab = soleSlab(print, { floor: z, thick: L.thick, welt });
        if (slab) put(`${id}Sole${i || ''}_${seg}`, { ...slab, group: L.group ?? 'Sole', bind: bindNearest(slab, P) });
        // (its pod: the print from the heel, `from` … `to` of its length, its own slab a little proud of the layer's wall)
        // (its tread: lugs round its edge, standing off it at its middle height)
        if (L.lugs && slab) {
          const mid = Object.fromEntries(Object.entries(slab.stations[0].points).map(([k, q]) => [k, [q[0], q[1], q[2] + L.thick / 2]]));
          studsOn(mid, { every: L.lugs.every ?? 3, over: -1, size: L.lugs.size ?? Math.min(0.008, L.thick * 0.9) }).forEach((b) => put(`${id}Lug${n.lug++}_${seg}`, { ...b, group: L.lugs.group ?? L.group ?? 'Sole', bind: bindNearest(b, P) }));
        }
        // (its heel: a block under the print's rear, from the layer's floor up, the foot still flat on it)
        if (L.heel && seg === fn && print.length) {
          const t = print.map(ahead), t0 = Math.min(...t), t1 = Math.max(...t), sub = print.filter((q, j) => (t[j] - t0) / (t1 - t0 || 1) <= (L.heel.to ?? 0.3));
          const blk = soleSlab(sub, { floor: z, thick: L.heel.thick ?? 0.02, welt });
          if (blk) put(`${id}Heel${i}_${seg}`, { ...blk, group: L.heel.group ?? 'Heel', bind: bindNearest(blk, P) });
        }
        if (L.pod && seg === fn && print.length) {
          const t = print.map(ahead), t0 = Math.min(...t), t1 = Math.max(...t), at = (q) => (q - t0) / (t1 - t0 || 1);
          const sub = print.filter((p, j) => at(t[j]) >= (L.pod.from ?? 0) && at(t[j]) <= (L.pod.to ?? 0.35));
          const pod = soleSlab(sub, { floor: z + L.thick * 0.2, thick: L.thick * 0.6, welt: welt + (L.pod.welt ?? 0.0015) });
          if (pod) put(`${id}Pod${i}_${seg}`, { ...pod, group: L.pod.group ?? 'Air', bind: bindNearest(pod, P) });
        }
        z += L.thick;
      });
    }
    // 3 ADORN, in the card's order
    for (const a of C.adorn ?? []) {
      if (a.prim === 'strap' || a.prim === 'band' || a.prim === 'cuff') {
        const strap = a.prim === 'strap', k = n[a.prim] ?? 0; if (a.prim !== 'cuff') n[a.prim]++;
        const where = a.prim === 'cuff' ? { on: collar.on, at: Math.min(1, collar.at + 0.02) } : a, seg = A.seg(where.on, S), P = on(seg); if (!P) continue;
        const dims = { strap: [0.0025, 0.015], band: [0.003, 0.006], cuff: [0.005, 0.03] }[a.prim];
        const band = strapBand(P, A.u(where.on, where.at), { lift: a.lift ?? dims[0], width: a.width ?? dims[1] }); if (!band) continue;
        const name = { strap: `${id}Strap${k}`, band: `${id}Band${k}`, cuff: `${id}Cuff` }[a.prim];
        put(`${name}_${seg}`, { ...band, group: a.group ?? ADORN_PRIMS[a.prim].group });
        if (strap && a.buckle) { const b = buckleOn(band, S === 'R' ? 1 : -1); put(`${id}Buckle${k}_${seg}`, { ...b, group: 'Brass', bind: bindNearest(b, P) }); }
      } else if (a.prim === 'panel') {
        // a PATTERN PIECE on a cobbler region: its stations along, its arc round (a pair where the region has two sides)
        const named = typeof a.region === 'string', R = named ? COBBLER_REGIONS[a.region] : a.region, kind = a.on ?? 'foot', seg = A.seg(kind, S), P = on(seg); if (!P) continue;
        const sts = P.stations.filter((st, i) => { const u = st.u ?? i; return u >= A.u(kind, R.along[0]) - 1e-9 && u <= A.u(kind, R.along[1]) + 1e-9; });
        const base = named ? `${id}${a.region[0].toUpperCase()}${a.region.slice(1)}` : `${id}Panel${n.panel++}`, g = a.group ?? PANEL_GROUPS[a.region] ?? 'Overlay';
        const sides = R.sides === 'both' ? [['lateral', 'Lat'], ['medial', 'Med']] : [[R.sides, R.sides === 'centre' ? '' : R.sides === 'lateral' ? 'Lat' : 'Med']];
        for (const [side, tag] of sides) {
          const pc = panelOn(P, sts, arcOf(P.slots, R, side, S), { lift: a.lift ?? 0.0025, thick: a.thick ?? 0.0015, rise: a.rise ?? 0 }); if (!pc) continue;
          put(`${base}${tag}_${seg}`, { ...pc, group: g, bind: bindNearest(pc, P) });
        }
      } else if (a.prim === 'laces') {
        // LACES between the eyestays' inner edges (the slot of each nearest the tongue), over the tongue
        const seg = A.seg('foot', S), P = on(seg); if (!P) continue;
        const E = COBBLER_REGIONS.eyestay, sts = P.stations.filter((st, i) => { const u = st.u ?? i; return u >= A.u('foot', E.along[0]) - 1e-9 && u <= A.u('foot', E.along[1]) + 1e-9; });
        const inner = (side) => { const arc = arcOf(P.slots, E, side, S), N = P.slots.length, j = (sl) => { const i = P.slots.indexOf(sl); return Math.min(i, N - i); }; return arc.reduce((b, sl) => (j(sl) < j(b) ? sl : b), arc[0]); };
        laceBars(P, sts, inner('lateral'), inner('medial'), { rows: a.rows ?? 5, lift: a.lift ?? 0.0055, w: a.w ?? 0.003 })
          .forEach((b) => put(`${id}Lace${n.lace++}_${seg}`, { ...b, group: a.group ?? 'Lace', bind: bindNearest(b, P) }));
      } else if (a.prim === 'toeCap') {
        // the half teacup: a quarter egg over the toes, mapped toe to toe (the toe base to past the tip, with `room` beyond
        // it: a shoe's toe allowance), as wide and as high as the toes and `lift` more, its bottom inside the sole, carried
        // by the toes; in the leather's own group it is the toe's shape (a dress shoe's sleek toe)
        if (!tb || !tt || !toes) continue;
        const lift = a.lift ?? 0.004, minZ = floor + soleThick / 2, side = [fwd[1], -fwd[0], 0];
        // (measured on the toes' leather and the skin under it, so neither shows past it)
        const pts = [toes, A.bare(tn)].filter(Boolean).flatMap(pointsOf).filter((p) => ahead(p) >= -0.002 && p[2] > floor + 0.002); if (!pts.length) continue;
        const across = pts.map((p) => (p[0] - tb[0]) * side[0] + (p[1] - tb[1]) * side[1]), c = (Math.max(...across) + Math.min(...across)) / 2;
        // (its tip at the frontmost of them, the toe line being oblique)
        const tMax = Math.max(...pts.map(ahead)), front = pts.map((q, j) => [ahead(q), across[j]]).filter(([t]) => t > tMax - 0.01), cTip = front.reduce((s, f) => s + f[1], 0) / front.length;
        const egg = { o: tb, fwd, side, c, cTip, minZ, p: 3, L: Math.max(ahead(tt), ...pts.map(ahead)) + lift + (a.room ?? 0.006),
          W: Math.max(...across.map((x) => Math.abs(x - c))) + lift, H: Math.max(...pts.map((p) => p[2])) - minZ + lift };
        const cap = quarterEgg(egg);
        // (the sock's leather under it tucked inside, so none pokes through)
        for (const seg of [fn, tn]) if (parts[`${id}_${seg}`]) parts[`${id}_${seg}`] = tuckUnderEgg(parts[`${id}_${seg}`], egg);
        put(`${id}ToeCap_${tn}`, { ...cap, group: a.group ?? 'Steel', bind: bindNearest(cap, toes) });
        // the rivets round its back edge
        if (a.rivets) for (const r of studsOn(cap.stations[0].points, { every: a.rivets, over: 0.004, ...(a.stud?.size ? { size: a.stud.size } : {}) })) put(`${id}Rivet${n.rivet++}_${tn}`, { ...r, group: a.stud?.group ?? 'Steel', bind: bindNearest(r, toes) });
      }
    }
  }
  // 4 TONE: the groups laid
  // (`named`: the groups the card or its skin names a tone for, over a palette's defaults; the operator's own over all)
  const tones = { ...FOOTWEAR_TONES, ...(C.tones || {}) };
  return { parts, tones: Object.fromEntries(Object.entries(tones).filter(([g]) => used.has(g) || (C.tones && Object.hasOwn(C.tones, g)))), named: Object.keys(C.tones || {}) };
}
