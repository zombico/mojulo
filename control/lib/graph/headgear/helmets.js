// headgear/helmets — the HELMET LIBRARY: a soldier's and an operator's helmets by tradition, each a CARD of words lowered
// onto the cowl (polygonizer/station-loft-adorn.js castCowl: a helmet is a cowl with `pad` under a hard `shell`, its face
// open, its edge by height round the head), worn from an outfit's `language.head` (outfit/expand.js). PURE DATA: a new
// helmet is a card.
//
// A card:
//   reads     what it is, in a line
//   shell     the cowl's words: `brow` (the front edge, eye units over the eyes), `opening` (the front's half-width,
//             radians, before the edge drops), `jaw` (the side edge: a share from the mouth to the chin, negative above the
//             mouth), `nape` (the back edge, m under the mouth, negative above), `pad` (m off the head: how tall the dome),
//             `shell` (passes bridging it taut and round), `rim`, `ridge` (a crest over the crown)
//   skirt     the flanges round its edge (the cowl's `brim` fittings): a full brim, a flared skirt over the sides and the
//             back, a peak over the brow; `at` the height (eye units) at the front, `lift` / `drop` its rise to the front
//             and its fall to the back (m)
//   fittings  more of the cowl's fittings (rivets and vent lugs as small `earpiece` discs, an NVG shroud)
//   tones     { Helmet, HelmetTrim } its colours by tradition (beneath the card's and the operator's)
//
// The head slot (`language.head`): a helmet's name, or { helmet, cover?, band?, net?, nvg? }:
//   cover  a camouflage word (outfit/camouflage.js), or true: the top's camouflage (else the helmet's own cloth tone)
//   band   an elastic band round the shell (a scrim band)
//   net    a net over the shell
//   nvg    a night-vision mount on the brow, the goggle stowed up on it
//   headset  a comms headset: an earcup over each ear and a boom mic before the mouth
//
//   HELMETS, HELMET_WORDS      the cards, their names
//   validateHead(head, at)     error strings
//   headOf(L)                  { helmet, cover, band, net, nvg } normalised, or null
//   helmetKit(head)            the cranium kit (one cowl), its id 'helmet'
//   helmetTones(head)          the tones it suggests
const TRIM = 'HelmetTrim';
// (a raised rim along the edge, in the shell's own colour: a rim in a darker group steps along the cast's cells)
const RIM = (w = 0.06, h = 0.0018) => ({ w, h });
const FULL = [-Math.PI, Math.PI];
/** a flange along the shell's own edge (the cowl's `brim` with `edge`): `th` its span (radians round from the front),
 * `len` out, `tilt` down from level (radians) */
const brim = (o) => ({ kind: 'brim', edge: true, th: FULL, len: 0.012, tilt: 0.9, t: 0.003, group: 'Helmet', ...o });
/** a small disc on the shell (a rivet, a vent lug, a mount), mirrored to the other side unless at the middle */
const stud = (X, Z, r = 0.006, o = {}) => [{ kind: 'earpiece', at: [X, Z], r, h: 0.004, cap: false, group: TRIM, ...o }, ...(X ? [{ kind: 'earpiece', at: [-X, Z], r, h: 0.004, cap: false, group: TRIM, ...o }] : [])];
/** the shell's words every helmet shares: an open face, a hard shell bridged round (`shell` passes) on a fine grid */
const SHELL = { mouth: 'open', shell: 120, cell: 0.05, thick: 0.004 };

export const HELMETS = Object.freeze({
  // THE STEEL POT (the M1): a round deep dome, its edge near level round the head over the ears, a narrow flange turned
  // out and down all round
  m1: { reads: 'the steel pot: a round deep dome, its edge near level over the ears, a narrow rolled flange all round',
    shell: { ...SHELL, opening: 1.55, brow: 1.75, jaw: -3, nape: -0.07, pad: 0.026, rim: RIM() },
    skirt: [brim({ len: 0.012, tilt: 0.85 })],
    tones: { Helmet: '#4b5320', HelmetTrim: '#3a4019' } },
  // THE COAL SCUTTLE (the Stahlhelm): deep, down over the ears and the nape, its skirt flared out at the sides and the
  // back, a short visor lip over the brow, the vent lugs at the temples
  stahlhelm: { reads: 'the coal-scuttle helmet: deep over the ears and the nape, its skirt flared out at the sides and the back, a short lip over the brow, vent lugs at the temples',
    shell: { ...SHELL, opening: 1.3, brow: 1.45, jaw: -0.6, nape: -0.005, pad: 0.022, rim: RIM(0.05) },
    skirt: [brim({ th: [0.9, 2 * Math.PI - 0.9], len: 0.024, tilt: 1.0 }), brim({ th: [-0.95, 0.95], len: 0.014, tilt: 0.6 })],
    fittings: stud(2.2, 1.7, 0.007),
    tones: { Helmet: '#5d6455', HelmetTrim: '#3f443a' } },
  // THE SOUP BOWL (the Brodie): a shallow bowl over the crown, a wide flat brim all round
  brodie: { reads: 'the soup-bowl helmet: a shallow bowl over the crown, a wide flat brim all round',
    shell: { ...SHELL, opening: 1.7, brow: 1.9, jaw: -3.3, nape: -0.075, pad: 0.02, rim: RIM(0.05) },
    skirt: [brim({ len: 0.045, tilt: 0.2, t: 0.0025 })],
    tones: { Helmet: '#6b6a45', HelmetTrim: '#4d4c31' } },
  // THE SSH-40: a rounded dome lower at the sides than the steel pot, a short flare, rivets round it
  ssh40: { reads: 'the Soviet helmet: a rounded dome down to the ear tops, a short flare, rivets round its side',
    shell: { ...SHELL, opening: 1.45, brow: 1.65, jaw: -2.4, nape: -0.05, pad: 0.024, rim: RIM() },
    skirt: [brim({ len: 0.008, tilt: 0.95 })],
    fittings: [...stud(1.9, 1.9, 0.005), ...stud(0, 3.0, 0.005)],
    tones: { Helmet: '#4f5a3a', HelmetTrim: '#3b4429' } },
  // THE ADRIAN: a dome under a crest front to back, a peak over the brow and a peak behind
  adrian: { reads: 'the crested helmet: a dome under a crest from front to back, a peak over the brow and one behind',
    shell: { ...SHELL, opening: 1.5, brow: 1.8, jaw: -3, nape: -0.07, pad: 0.02, rim: RIM(0.05), ridge: { w: 0.12, h: 0.008 } },
    skirt: [brim({ th: [-1.0, 1.0], len: 0.03, tilt: 0.45, t: 0.0025 }), brim({ th: [Math.PI - 0.85, Math.PI + 0.85], len: 0.026, tilt: 0.6, t: 0.0025 })],
    tones: { Helmet: '#7a8fa0', HelmetTrim: '#5c6d7a' } },
  // THE PASGT (the K-pot): a lip over the brow, down over the ears, the back swept out over the nape
  pasgt: { reads: 'the K-pot: a lip over the brow, down over the ears, the back swept out over the nape',
    shell: { ...SHELL, opening: 1.3, brow: 1.5, jaw: -1.2, nape: -0.01, pad: 0.024, rim: RIM(0.05) },
    skirt: [brim({ th: [-0.85, 0.85], len: 0.01, tilt: 0.6 }), brim({ th: [1.4, 2 * Math.PI - 1.4], len: 0.016, tilt: 0.95 })],
    tones: { Helmet: '#4b5038', HelmetTrim: '#33362a' } },
  // THE MID CUT (MICH / ACH): close and round, the ears shown under its cut, an NVG shroud on the brow
  ach: { reads: 'the mid-cut helmet: close and round, cut up over the ears, an NVG shroud on the brow',
    shell: { ...SHELL, opening: 1.3, brow: 1.65, jaw: -2.2, nape: -0.03, pad: 0.018, rim: RIM(0.07, 0.002) },
    fittings: [{ kind: 'earpiece', at: [0, 2.2], r: 0.014, h: 0.006, group: TRIM, capGroup: TRIM }, ...stud(2.4, 0.6, 0.006)],
    tones: { Helmet: '#5b5d45', HelmetTrim: '#2f3126' } },
  // THE HIGH CUT: a bump shell cut high over the ears for a headset, rails along its sides, a shroud on the brow
  highcut: { reads: 'the high-cut helmet: a bump shell cut high over the ears for a headset, rails along its sides, a shroud on the brow',
    shell: { ...SHELL, opening: 1.25, brow: 1.6, jaw: -3, nape: -0.02, pad: 0.014, rim: RIM(0.08, 0.0015) },
    fittings: [{ kind: 'earpiece', at: [0, 2.35], r: 0.014, h: 0.008, group: TRIM, capGroup: TRIM }, { kind: 'arm', at: [2.1, 1.25], to: [3.0, 0.7], r: 0.004, lift: 0.002, arch: 0.002, group: TRIM }, { kind: 'arm', at: [-2.1, 1.25], to: [-3.0, 0.7], r: 0.004, lift: 0.002, arch: 0.002, group: TRIM }],
    tones: { Helmet: '#8a7652', HelmetTrim: '#3a3226' } },
});
export const HELMET_WORDS = Object.freeze(Object.keys(HELMETS));
const EXTRAS = ['cover', 'band', 'net', 'nvg', 'headset'];

/** error strings for a language's `head` */
export function validateHead(head, at = 'head', camos = []) {
  if (head === undefined || head === false) return [];
  const o = typeof head === 'string' ? { helmet: head } : head;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return [`${at}: a helmet (${HELMET_WORDS.join(', ')}) or { helmet, cover?, band?, net?, nvg?, headset? }`];
  const errs = [];
  if (!HELMETS[o.helmet]) errs.push(`${at}.helmet: one of ${HELMET_WORDS.join(', ')}`);
  for (const k of Object.keys(o)) if (k !== 'helmet' && !EXTRAS.includes(k)) errs.push(`${at}.${k}: not a head word (helmet, ${EXTRAS.join(', ')})`);
  if (o.cover !== undefined && o.cover !== true && o.cover !== false && !camos.includes(o.cover)) errs.push(`${at}.cover: true (the top's camouflage), false, or a camouflage (${camos.join(', ')})`);
  for (const k of ['band', 'net', 'nvg', 'headset']) if (o[k] !== undefined && typeof o[k] !== 'boolean') errs.push(`${at}.${k}: true or false`);
  return errs;
}

/** a language's head slot normalised: { helmet, cover, band, net, nvg, headset }, or null (none). `cover` true reads the top's
 * pattern when it is a camouflage (`isCamo`), else stays true (a cloth cover in the helmet's own tone) */
export function headOf(L, isCamo = () => false) {
  const h = L?.head; if (!h) return null;
  const o = typeof h === 'string' ? { helmet: h } : h; if (!HELMETS[o.helmet]) return null;
  const topPat = typeof L.top?.pattern === 'string' ? L.top.pattern : L.top?.pattern?.kind;
  const cover = o.cover === true ? (isCamo(topPat) ? topPat : true) : o.cover || false;
  return { helmet: o.helmet, cover, band: !!o.band, net: !!o.net, nvg: !!o.nvg, headset: !!o.headset };
}

// (a net: meridians from the crown down and rings round, thin cords; a band: one wide cord round the shell)
const meridian = (th) => ({ kind: 'lines', side: 'R', style: 'cord', w: 0.0022, group: 'HelmetNet', samples: 24, path: [{ th, rho: 0.08 }, { th, rho: 0.6 }, { th, rho: 1.1 }] });
const ringAt = (rho, w, group, samples = 64) => ({ kind: 'lines', side: 'R', style: 'cord', w, group, samples, path: Array.from({ length: 33 }, (_, i) => ({ th: -Math.PI + (2 * Math.PI * i) / 32, rho })) });

/** the cranium kit a head slot wears: one cowl (its skirt and fittings among its fittings, the band and the net its
 * ornaments), the shell in `Helmet`, its trim in `HelmetTrim`. `[]` for none */
export function helmetKit(H) {
  if (!H) return [];
  const C = HELMETS[H.helmet], S = C.shell;
  const fittings = [...(C.skirt || []), ...(C.fittings || []),
    // (a night-vision mount on the brow, the goggle stowed up on it: a plate and two tubes pointing up and forward)
    // (a comms headset: a bulky cup over each ear, out past the shell, a boom from the right cup to before the mouth)
    ...(H.headset ? [...[1, -1].map((sg) => ({ kind: 'earpiece', at: [sg * 3.05, -0.3], r: 0.032, h: 0.02, out: 0.008, group: 'HelmetComms', capGroup: TRIM })),
      { kind: 'arm', at: [2.95, -0.75], to: [0.75, 'mouth'], r: 0.0026, lift: 0.014, arch: 0.012, group: 'HelmetComms' }, { kind: 'valve', at: [0.7, 'mouth'], r: 0.008, group: 'HelmetComms' }] : []),
    ...(H.nvg ? [{ kind: 'earpiece', at: [0, 2.15], r: 0.017, h: 0.007, group: TRIM, capGroup: TRIM }, ...[0.32, -0.32].map((x) => ({ kind: 'scope', at: [x, 2.55], r: 0.011, len: 0.04, group: 'HelmetNvg', lensGroup: 'HelmetLens' }))] : [])];
  const ornaments = [...(H.band ? [ringAt(0.95, 0.018, 'HelmetBand', 96)] : []), ...(H.net ? [...Array.from({ length: 12 }, (_, i) => meridian(-Math.PI + (2 * Math.PI * i) / 12)), ringAt(0.45, 0.0022, 'HelmetNet'), ringAt(0.8, 0.0022, 'HelmetNet')] : [])];
  return [{ id: 'helmet', mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Helmet', rigid: true, stack: false, ghost: true,
    signature: { kind: 'cowl', group: 'Helmet', ...S, ...(fittings.length ? { fittings } : {}), ...(ornaments.length ? { ornaments } : {}) } }];
}

/** the tones a head slot suggests: the card's, the band's and the net's, the NVG's (beneath the card's and the operator's) */
export function helmetTones(H) {
  if (!H) return {};
  const T = HELMETS[H.helmet].tones;
  return { ...T, ...(H.band ? { HelmetBand: '#2b2a22' } : {}), ...(H.net ? { HelmetNet: '#3a3626' } : {}), ...(H.nvg ? { HelmetNvg: '#1d1f1c', HelmetLens: '#3d6b4f' } : {}), ...(H.headset ? { HelmetComms: '#22231f' } : {}) };
}
