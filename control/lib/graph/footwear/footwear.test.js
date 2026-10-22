// footwear.test.js — the library on a stub foot adapter (a box foot, toes and shank, each a ring per station): the parts
// read nothing of a body but its adapter. The sole split at the toe base and under the foot, the straps at their shares
// with a buckle on the outer side, a sandal with no upper, a part not asked for adding nothing, the same twice.
import { describe, it, expect } from 'vitest';

import { wearFootwear, validateFootwear, footwearCard, readTones, SKINS } from './index.js';
import { compileLayered, auditLayered } from '../polygonizer/station-loft.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';

// a ring of 8 round `c` in ring order (ringSlots: `front` first, the R side on +x): level (the shank's, its front +y), or
// square to y (the foot's and the toes', `rz` its half height, its front on top)
const SL = ringSlots(8);
const mean8 = (ring) => { const ps = Object.values(ring); return [0, 1, 2].map((q) => ps.reduce((t, p) => t + p[q], 0) / ps.length); };
const ring = (c, rx, rz, level) => Object.fromEntries(SL.map((nm, j) => { const a = (2 * Math.PI * j) / 8;
  return [nm, level ? [c[0] + rx * Math.sin(a), c[1] + rz * Math.cos(a), c[2]] : [c[0] + rx * Math.sin(a), c[1], c[2] + rz * Math.cos(a)]]; }));
// a segment from `from` to `to`, 9 stations, u 0 … 2
const seg = (bone, from, to, rx, rz) => ({ layer: 0, closure: 'closed', slots: SL,
  stations: Array.from({ length: 9 }, (_, i) => ({ id: `st${i}`, u: i / 4, points: ring(from.map((x, q) => x + ((to[q] - x) * i) / 8), rx, rz, from[2] !== to[2]) })),
  caps: { back: from, tip: to }, bind: { bone } });
// (the foot and the toes: rings in the xz plane, square to y; the shank: rings level)
const skin = { footR: seg('footR', [0.1, 0, 0.03], [0.1, 0.12, 0.03], 0.04, 0.03), toesR: seg('toesR', [0.1, 0.12, 0.03], [0.1, 0.2, 0.03], 0.035, 0.03), shankR: seg('shankR', [0.1, 0, 0.45], [0.1, 0, 0.06], 0.045, 0.045) };
const stub = { sides: ['R'], seg: (kind, S) => `${kind}${S}`, joints: () => ({ ankle: [0.1, 0, 0.06], toeBase: [0.1, 0.12, 0.02], toeTip: [0.1, 0.2, 0.015] }),
  bare: (name) => skin[name], u: (_k, share) => 2 * share,
  upper: (sock, { id, group }) => Object.fromEntries(['footR', 'toesR', ...(sock.height === 'boot' ? ['shankR'] : [])].map((n) => [`${id}_${n}`, { ...skin[n], layer: 1, group }])) };

describe('footwear on a foot adapter', () => {
  it('a shoe: its upper, a sole under the foot and the toes split at the toe base, a strap and its buckle outside', () => {
    const W = wearFootwear(stub, { sock: { height: 'shoe' }, sole: { thick: 0.008, welt: 0.003 }, adorn: [{ prim: 'strap', on: 'foot', at: 0.5, buckle: true }] }, { id: 'shoe' });
    expect(Object.keys(W.parts).sort()).toEqual(['shoeBuckle0_footR', 'shoeSole_footR', 'shoeSole_toesR', 'shoeStrap0_footR', 'shoe_footR', 'shoe_toesR']);
    const ys = (P) => P.stations.flatMap((s) => Object.values(s.points)).map((p) => p[1]);
    expect(Math.max(...ys(W.parts.shoeSole_footR))).toBeLessThan(Math.min(...ys(W.parts.shoeSole_toesR)) + 0.02);
    for (const k of ['shoeSole_footR', 'shoeSole_toesR']) expect(Object.values(W.parts[k].stations[0].points)[0][2]).toBeCloseTo(0, 6);
    // the buckle on the right foot's outer (+x) side of its strap
    const bx = Object.values(W.parts.shoeBuckle0_footR.stations[0].points)[0][0];
    expect(bx).toBeGreaterThan(0.1);
    expect(Object.keys(W.tones).sort()).toEqual(['Brass', 'Sole', 'Strap']);   // the groups it laid, no more
  });

  it('a sandal has no upper, its straps on the bare foot; what is not asked for adds nothing; the same twice', () => {
    const spec = { sock: false, sole: { thick: 0.01, welt: 0.004 }, adorn: [{ prim: 'strap', on: 'foot', at: 0.3 }] };
    const W = wearFootwear(stub, spec, { id: 'sandal' });
    expect(Object.keys(W.parts).sort()).toEqual(['sandalSole_footR', 'sandalSole_toesR', 'sandalStrap0_footR']);
    expect(W.parts.sandalStrap0_footR.bind.bone).toBe('footR');
    expect(JSON.stringify(wearFootwear(stub, spec, { id: 'sandal' }))).toBe(JSON.stringify(W));
  });

  it('a steel toe: a shell over the toe box outside the sock, closed at the tip, kept over the sole; rivets on its edge', () => {
    const W = wearFootwear(stub, { sock: { height: 'boot', shaft: 0.3 }, sole: { thick: 0.012, welt: 0.004 }, adorn: [{ prim: 'toeCap', rivets: 2 }, { prim: 'cuff' }, { prim: 'band', on: 'shank', at: 0.9 }] }, { id: 'work' });
    const cap = W.parts.workToeCap_toesR, under = skin.toesR;
    expect(cap.group).toBe('Steel');
    expect(cap.caps.tip[1]).toBeGreaterThan(0.2);   // the teacup's front past the toe tip
    const z = Object.values(cap.stations).flatMap((st) => Object.values(st.points)).map((p) => p[2]);
    expect(Math.min(...z)).toBeGreaterThanOrEqual(0.006 - 1e-9);   // never under the sole's middle
    // one piece over the toes, carried by them; outside them: wider than the toes anywhere along them
    expect(W.parts.workToeCap_footR).toBeUndefined();
    expect(cap.bind.bone).toBe('toesR');
    const halfW = (pts) => Math.max(...pts.map((p) => Math.abs(p[0] - 0.1)));
    expect(halfW(cap.stations.flatMap((st) => Object.values(st.points)))).toBeGreaterThan(halfW(under.stations.flatMap((st) => Object.values(st.points))));
    // the sock's toes under it tucked inside: none of its points past the cap's reach across
    const sock = W.parts.work_toesR.stations.flatMap((st) => Object.values(st.points));
    expect(halfW(sock)).toBeLessThan(halfW(cap.stations.flatMap((st) => Object.values(st.points))));
    expect(sock).not.toEqual(skin.toesR.stations.flatMap((st) => Object.values(st.points)));
    const A = auditLayered(compileLayered({ schema: 'layered-v1', frame: { up: 'z' }, dials: {}, parts: { cap: { ...cap, bind: undefined } } }, {}, { details: false, creases: false }));
    for (const k of ['cap']) { expect(A[k].pass, k).toBe(true); expect(A[k].windingErrors, k).toBe(0); }
    const rivets = Object.keys(W.parts).filter((k) => k.startsWith('workRivet'));
    expect(rivets.length).toBeGreaterThan(0);
    for (const k of rivets) expect(W.parts[k].bind.bone).toBe('toesR');
    expect(W.parts.workCuff_shankR.group).toBe('Cuff');
    expect(W.parts.workBand0_shankR.group).toBe('Gilt');
    expect(Object.keys(W.tones).sort()).toEqual(['Cuff', 'Gilt', 'Sole', 'Steel']);
  });

  it('a layered sole: its layers stacked from the floor, each in its group; a pod at the heel proud of its layer', () => {
    const card = { family: 'sneaker', sock: { height: 'shoe' }, sole: { layers: [{ thick: 0.004, welt: 0.004, group: 'Outsole' }, { thick: 0.02, welt: 0.005, group: 'Midsole', pod: { to: 0.4 } }] } };
    const W = wearFootwear(stub, card, { id: 'run' }), lo = (P, k) => Object.values(P.stations[k].points)[0][2];
    expect(W.parts.runSole_footR.group).toBe('Outsole');
    expect(W.parts.runSole1_footR.group).toBe('Midsole');
    expect(lo(W.parts.runSole1_footR, 0)).toBeCloseTo(lo(W.parts.runSole_footR, 1), 6);   // the midsole on the outsole
    const pod = W.parts.runPod1_footR, ys = (P) => P.stations.flatMap((st) => Object.values(st.points)).map((p) => p[1]);
    expect(pod.group).toBe('Air');
    expect(Math.max(...ys(pod))).toBeLessThan(Math.max(...ys(W.parts.runSole1_footR)));   // at the heel, not the whole print
    expect(W.parts.runPod1_toesR).toBeUndefined();
    expect(Object.keys(W.tones).sort()).toEqual(['Air', 'Midsole', 'Outsole']);
  });

  it('cut as a cobbler: the tongue down the centre and above the collar, a matching pair of quarters, laces across', () => {
    const W = wearFootwear(stub, { family: 'sneaker', sock: { height: 'shoe' }, sole: { thick: 0.01, welt: 0.003 },
      adorn: [{ prim: 'panel', region: 'tongue', rise: 0.01 }, { prim: 'panel', region: 'quarter' }, { prim: 'panel', region: 'eyestay', lift: 0.004 }, { prim: 'laces', rows: 4 }] }, { id: 'snk' });
    const pts = (P) => P.stations.flatMap((st) => Object.values(st.points)), xs = (P) => pts(P).map((p) => p[0] - 0.1);
    const T = W.parts.snkTongue_footR;
    expect(Math.max(...pts(T).map((p) => p[2]))).toBeGreaterThan(0.06);   // on top, over the instep
    expect(T.stations.length).toBe(stub.bare('footR').stations.filter((st) => st.u <= 2 * 0.84 + 1e-9).length + 1);   // and risen past its first ring
    // the quarters a matching pair, the lateral on the right foot's outer (+x) side, the medial mirrored
    const lat = W.parts.snkQuarterLat_footR, med = W.parts.snkQuarterMed_footR;
    expect(Math.min(...xs(lat))).toBeGreaterThan(0);
    expect(Math.max(...xs(med))).toBeLessThan(0);
    expect(Math.abs(Math.max(...xs(lat)) + Math.min(...xs(med)))).toBeLessThan(1e-6);
    expect(Math.max(...xs(T).map(Math.abs))).toBeLessThan(Math.max(...xs(lat)));   // the tongue down the centre, narrower than the sides
    expect([lat.group, T.group, W.parts.snkEyestayLat_footR.group]).toEqual(['Overlay', 'Tongue', 'Eyestay']);
    const laces = Object.keys(W.parts).filter((k) => k.startsWith('snkLace'));
    expect(laces.length).toBe(6);   // two bars between each of the four rows
    for (const k of laces) { expect(W.parts[k].group).toBe('Lace'); expect(Math.min(...pts(W.parts[k]).map((p) => p[2]))).toBeGreaterThan(0.045); }   // over the top half
    const A = auditLayered(compileLayered({ schema: 'layered-v1', frame: { up: 'z' }, dials: {}, parts: { t: { ...T, bind: undefined }, q: { ...lat, bind: undefined } } }, {}, { details: false, creases: false }));
    for (const k of ['t', 'q']) { expect(A[k].pass, k).toBe(true); expect(A[k].windingErrors, k).toBe(0); }
  });

  it('a variety is its kin and a few keys; a colourway recolours any card; a heel and a tread are sole patterns', () => {
    const kin = { family: 'sneaker', sock: { height: 'shoe', collar: 0.1 }, sole: { thick: 0.01, welt: 0.003 }, adorn: [{ prim: 'panel', region: 'quarter' }], tones: { Overlay: '#112233' } };
    const C = footwearCard({ from: kin, sock: { thick: 0.006 }, adornPlus: [{ prim: 'panel', region: 'counter' }], skin: 'volt' });
    expect(C.sock).toEqual({ height: 'shoe', collar: 0.1, thick: 0.006 });   // merged
    expect(C.adorn.map((a) => a.region)).toEqual(['quarter', 'counter']);   // appended
    expect(C.tones.Overlay).toBe(SKINS.volt.Overlay);   // the skin over the card's own
    const W = wearFootwear(stub, { from: kin, skin: 'volt' }, { id: 'v' });
    expect(W.named).toEqual(expect.arrayContaining(['Overlay', 'Shoes']));
    expect(W.tones.Overlay).toBe(SKINS.volt.Overlay);
    // the same parts as the card in its own colours: a skin is colour alone
    const plain = wearFootwear(stub, kin, { id: 'v' });
    expect(Object.keys(W.parts)).toEqual(Object.keys(plain.parts));
    expect(JSON.stringify(W.parts)).toBe(JSON.stringify(plain.parts));
    // a heel block under the print's rear, taller than its layer; lugs round the outsole
    const D = wearFootwear(stub, { sock: { height: 'shoe' }, sole: { layers: [{ thick: 0.006, welt: 0.004, heel: { to: 0.3, thick: 0.024 }, lugs: { every: 4 } }] } }, { id: 'd' });
    const hz = D.parts.dHeel0_footR.stations.map((st) => Object.values(st.points)[0][2]), ys = (P) => P.stations.flatMap((st) => Object.values(st.points)).map((p) => p[1]);
    expect(hz[1] - hz[0]).toBeCloseTo(0.024, 6);
    expect(Math.max(...ys(D.parts.dHeel0_footR))).toBeLessThan(Math.max(...ys(D.parts.dSole_footR)) - 0.02);
    expect(D.parts.dHeel0_toesR).toBeUndefined();
    expect(Object.keys(D.parts).filter((k) => k.startsWith('dLug')).length).toBeGreaterThan(2);
  });

  it('a tone of the leather follows the leather: recolour the shoes and the pieces cut from them follow, in their shades', () => {
    const P = readTones({ Shoes: '#804020', Cap: { of: 'Shoes', shade: -0.5 }, Lift: { of: 'Cap', shade: 0.5 }, Lace: '#111111' });
    expect(P).toEqual({ Shoes: '#804020', Cap: '#402010', Lift: '#a09088', Lace: '#111111' });
    expect(readTones({ Shoes: '#ffffff', Cap: { of: 'Shoes', shade: -0.5 } }).Cap).toBe('#808080');
    expect(readTones({ Cap: { of: 'Nothing', shade: 0 } }).Cap).toBe('#808080');   // a group it names missing: a mid grey
    expect(validateFootwear({ sock: { height: 'shoe' }, tones: { Cap: { of: 'Shoes', shade: -2 } } })[0]).toMatch(/tones.Cap: '#rrggbb', or \{ of/);
  });

  it('on heels: the stance the rig stands in, the heel and the soles under the floor of the bind, rigid on their bones', () => {
    const W = wearFootwear(stub, { family: 'dress', sock: { height: 'shoe' }, heels: { height: 0.08, toe: 0.006, kind: 'stiletto' } }, { id: 'p' });
    expect(W.stance.toe).toBe(0.006);
    expect(W.stance.pitch).toBeGreaterThan(20);
    expect(W.stance.rise).toBeGreaterThan(0.006);
    const zs = (P) => P.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2]);
    expect(Math.min(...zs(W.parts.pHeel_footR))).toBeLessThan(-0.04);   // the heel reaches down to where the ground will be
    expect(Math.min(...zs(W.parts.pSole_toesR))).toBeCloseTo(-0.006, 6);   // the toes on their sole
    for (const k of ['pHeel_footR', 'pSole_footR']) expect(W.parts[k].bind).toEqual({ bone: 'footR', blend: {} });
    // the stiletto's foot drawn in: its bottom ring far smaller than its top
    const span = (pts) => Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const H = W.parts.pHeel_footR; expect(span(Object.values(H.stations[0].points))).toBeLessThan(0.4 * span(Object.values(H.stations[1].points)));
    // a wedge fills the sole down under the arch, no heel of its own; no heels, no stance
    const Wd = wearFootwear(stub, { sock: { height: 'shoe' }, heels: { height: 0.07, toe: 0.01, kind: 'wedge' } }, { id: 'w' });
    expect(Wd.parts.wHeel_footR).toBeUndefined();
    expect(Math.min(...zs(Wd.parts.wSole_footR))).toBeLessThan(-0.04);
    expect(wearFootwear(stub, { sock: { height: 'shoe' } }, { id: 'f' }).stance).toBeUndefined();
  });

  it('a boot cut as a cobbler cuts it: the quarters up the shaft wrapping round to the back, the tongue rising above it', () => {
    const W = wearFootwear(stub, { family: 'boot', sock: { height: 'boot', shaft: 0.5 }, sole: { thick: 0.01, welt: 0.003 },
      adorn: [{ prim: 'panel', region: 'quarter' }, { prim: 'panel', region: 'tongue', rise: 0.012 }, { prim: 'laces', rows: 3, shaftRows: 3 }] }, { id: 'b' });
    const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));
    const lat = W.parts.bQuarterLat_shankR, med = W.parts.bQuarterMed_shankR;
    expect(lat && med).toBeTruthy();
    // round to the back (−y, behind the shin) from either side, meeting there
    expect(Math.min(...pts(lat).map((p) => p[1]))).toBeLessThan(-0.03);
    expect(Math.min(...pts(med).map((p) => p[1]))).toBeLessThan(-0.03);
    expect(Math.min(...pts(lat).map((p) => p[0] - 0.1))).toBeGreaterThan(-0.02);
    // the tongue on the shaft risen past the boot's top; the foot's piece not risen
    const top = Math.max(...pts(W.parts.b_shankR).map((p) => p[2]));
    expect(Math.max(...pts(W.parts.bTongue_shankR).map((p) => p[2]))).toBeGreaterThan(top + 0.01);
    expect(W.parts.bTongue_footR.stations.length).toBe(stub.bare('footR').stations.filter((st) => st.u <= 2 * 0.84 + 1e-9).length);
    expect(Object.keys(W.parts).some((k) => /^bLace\d+_shankR$/.test(k))).toBe(true);
    // the ankle bridged: the foot's leather from the ankle to where the foot's quarter begins, cut round as the shaft's
    const br = W.parts.bQuarterAnkleLat_footR;
    expect(br.stations[0].id).toBe('st0');
    expect(br.slots.length).toBe(lat.slots.length);
    // a shoe has no shaft: its pieces on the foot alone
    const shoe = wearFootwear(stub, { sock: { height: 'shoe' }, adorn: [{ prim: 'panel', region: 'quarter' }] }, { id: 's' });
    expect(Object.keys(shoe.parts).filter((k) => k.endsWith('_shankR'))).toEqual([]);
  });

  it('fantasy, drama, history: a curled point, crossed wraps, a bucket top, a geta standing level, wings, buttons, a spur, a jewel', () => {
    const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));
    const W = wearFootwear(stub, { family: 'fantasy', sock: { height: 'boot', shaft: 0.6 }, sole: { thick: 0.008 },
      adorn: [{ prim: 'toePoint', length: 0.06, curl: 120, bell: true }, { prim: 'wrap', from: 0.45, to: 0.95, turns: 2, cross: true }, { prim: 'flare', height: 0.06, spread: 1.8 },
        { prim: 'buttons', count: 4 }, { prim: 'spur' }, { prim: 'wings', feathers: 3 }, { prim: 'jewel', at: 'instep' }] }, { id: 'x' });
    // the point curls up: its last ring's middle far over its first's
    const T = W.parts.xToePoint_toesR, c0 = mean8(T.stations[0].points), c1 = mean8(T.stations[T.stations.length - 1].points);
    expect(c1[2] - c0[2]).toBeGreaterThan(0.02);
    expect(W.parts.xBell_toesR.group).toBe('Bell');
    // crossed: two ribbons, one each way round
    expect([W.parts.xWrap0_shankR.group, W.parts.xWrap1_shankR.group]).toEqual(['Wrap', 'Wrap']);
    // the bucket top opens out past the boot's top and rises over it
    const top = W.parts.x_shankR.stations[0].points, F = W.parts.xFlare_shankR, reach = (ring) => { const m = mean8(ring); return Math.max(...Object.values(ring).map((p) => Math.hypot(p[0] - m[0], p[1] - m[1]))); };
    expect(reach(F.stations[F.stations.length - 1].points)).toBeGreaterThan(1.5 * reach(top));
    expect(Math.max(...pts(F).map((p) => p[2]))).toBeGreaterThan(Math.max(...Object.values(top).map((p) => p[2])) + 0.05);
    expect(Object.keys(W.parts).filter((k) => /^xButton\d+_shankR$/.test(k)).length).toBe(4);
    expect([W.parts.xRowel_footR.group, W.parts.xRowel_footR.bind]).toEqual(['Steel', { bone: 'footR', blend: {} }]);
    expect(Object.keys(W.parts).filter((k) => /^xWing(Lat|Med)\d_shankR$/.test(k)).length).toBe(6);
    expect(W.parts.xJewel_footR.group).toBe('Gem');
    // the geta: the foot raised level (no pitch), the body risen by the whole height, two teeth
    const G = wearFootwear(stub, { family: 'historic', sock: false, heels: { height: 0.06, toe: 0.06, shank: 0.015, kind: 'teeth' } }, { id: 'g' });
    expect(G.stance).toEqual({ rise: 0.06, toe: 0.06, pitch: 0 });
    expect(Object.keys(G.parts).filter((k) => /^gTooth(Front|Back)_footR$/.test(k)).length).toBe(2);
  });

  it('a shaggy ruff of fur round the collar, seeded: the same twice, another seed another shag', () => {
    const card = (seed) => ({ family: 'fantasy', sock: { height: 'boot', shaft: 0.4 }, adorn: [{ prim: 'fur', length: 0.03, seed }] });
    const W = wearFootwear(stub, card(1), { id: 'f' }), F = W.parts.f_shankR && W.parts.fFur_shankR;
    expect(F.group).toBe('Fur');
    // out from the collar and drooping below it
    const top = W.parts.f_shankR.stations[0].points, tz = Math.min(...Object.values(top).map((p) => p[2])), last = F.stations[F.stations.length - 1].points;
    expect(Math.min(...Object.values(last).map((p) => p[2]))).toBeLessThan(tz - 0.01);
    expect(JSON.stringify(wearFootwear(stub, card(1), { id: 'f' }).parts.fFur_shankR)).toBe(JSON.stringify(F));
    expect(JSON.stringify(wearFootwear(stub, card(2), { id: 'f' }).parts.fFur_shankR)).not.toBe(JSON.stringify(F));
  });

  it('refuses a card by name', () => {
    expect(validateFootwear({ sock: { height: 'shoe' }, adorn: [{ prim: 'panel', region: 'pullLoop' }] })[0]).toMatch(/region: one of tongue, eyestay/);
    expect(validateFootwear({ from: 'runners', skin: 'neon' })[0]).toMatch(/skin: a colourway \(tripleBlack/);
    expect(validateFootwear({ from: 'runners', colour: 'red' })[0]).toMatch(/not 'colour'/);
    expect(validateFootwear({ sock: { height: 'shoe' }, adorn: [{ prim: 'flare' }, { prim: 'jewel', at: 'knee' }] })).toEqual(['footwear.adorn[0]: a flare is a boot\'s; this card\'s sock is no boot', 'footwear.adorn[1].at: toe, instep or ankle']);
    expect(validateFootwear({ sock: { height: 'shoe' }, heels: { height: 0.05, toe: 0.06 } })).toContain('footwear.heels: the heel must stand at least as high as the toes\' sole');
    expect(validateFootwear({ family: 'clog', sole: { thick: 0.01, layers: [{ thick: 0 }] } })).toEqual(['footwear.family: one of shoe, boot, sandal, sneaker, dress, historic, fantasy',
      'footwear.sole.layers[0].thick: metres, over 0 and at most 0.1', 'footwear.sole: layers, or thick and welt (one layer), not both']);
    expect(validateFootwear('clogs')[0]).toMatch(/'clogs' is not a footwear word/);
    expect(validateFootwear({ sock: false, adorn: [{ prim: 'cuff' }] })[0]).toMatch(/worn on the sock; this card has none/);
    expect(validateFootwear({ sock: { height: 'boot' }, adorn: [{ prim: 'strap', on: 'hand', at: 2, colour: 1 }] })).toEqual([
      "footwear.adorn[0]: strap takes on, at, width, lift, buckle, group, not 'colour'", 'footwear.adorn[0].on: foot or shank', 'footwear.adorn[0].at: a share, 0 to 1']);
    expect(() => wearFootwear(stub, 'clogs')).toThrow(/clogs/);
  });
});

describe('footwear sized to the foot', () => {
  it('a foot k times the size wears the card scaled by k, piece for piece; a reference-size foot wears it as it is', async () => {
    const { scalePart, scaleParts } = await import('./parts.js');
    const { FOOT_REFERENCE, footLength } = await import('./index.js');
    const card = { sock: { height: 'boot', thick: 0.004 }, sole: { thick: 0.012, welt: 0.004 }, heels: { height: 0.06, toe: 0.01, kind: 'block' }, adorn: [{ prim: 'strap', on: 'shank', at: 0.7, buckle: true }, { prim: 'toeCap', lift: 0.002 }] };
    // (the stub to six decimals, the precision a body's points carry, so a factor of two carries it there and back
    // exactly: its rings are perfectly symmetric, and a tie broken differently would move the sole's outline)
    const ref = { ...stub, bare: (n) => scalePart(stub.bare(n), 1), upper: (sock, o) => scaleParts(stub.upper(sock, o), 1) };
    // (at the reference's size: its own foot reported as the reference's, worn as it is)
    const L0 = footLength(ref), W0 = wearFootwear({ ...ref, size: () => FOOT_REFERENCE }, card, { id: 'b' });
    expect(JSON.stringify(W0)).toBe(JSON.stringify(wearFootwear(ref, card, { id: 'b' })));
    // (the same foot twice the size, reporting its foot: every piece is the reference's scaled, and the heel's stance)
    const k = 2, big = { ...ref, size: () => FOOT_REFERENCE * k, joints: (S) => Object.fromEntries(Object.entries(ref.joints(S)).map(([n, p]) => [n, p.map((x) => x * k)])),
      bare: (n) => scalePart(ref.bare(n), k), upper: (sock, o) => scaleParts(ref.upper(sock, o), k) };
    expect(footLength(big)).toBeCloseTo(L0 * k, 9);
    const W = wearFootwear(big, card, { id: 'b' });
    expect(Object.keys(W.parts)).toEqual(Object.keys(W0.parts));
    for (const [n, P] of Object.entries(W.parts)) { const Q = scalePart(W0.parts[n], k); P.stations.forEach((st, i) => Object.entries(st.points).forEach(([sl, p]) => p.forEach((x, q) => expect(x, `${n} ${st.id}.${sl}[${q}]`).toBeCloseTo(Q.stations[i].points[sl][q], 5)))); }
    expect(W.stance.rise).toBeCloseTo(W0.stance.rise * k, 5);
    expect(W.stance.pitch).toBeCloseTo(W0.stance.pitch, 5);
  });
});
