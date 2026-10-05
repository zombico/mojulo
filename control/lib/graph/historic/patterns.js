/**
 * historic/patterns — the shared visual vocabulary of historic cities. A pattern is what reads at a
 * glance (a flat-roofed earthen cube, a stepped platform, a niched wall, a courtyard house, a towered
 * wall), recorded ONCE and reused by every culture that built it — and not only buildings: a town
 * also carries its ART (statues, stelae, door emblems, friezes, mosaic, vessels, altars), placed by
 * meaning at thresholds and on the sacred axis, and its STREET STRUCTURES (wells, kilns, granaries,
 * boats), placed by need; a culture (./cultures/) is a palette
 * plus a choice and weighting of patterns. The study is a big visual read, not an inventory: `seenIn`
 * notes where a pattern recurs, roughly, to keep the vocabulary shared — it is not a gate.
 *
 * Builders return plain masses in METRES ({ x, y, w, d, z0, z1, kind, tint }); the emitter converts to
 * scene units. Pure: any dice come in as an rng.
 */

export const PATTERNS = {
  // ── surfaces ──
  'sun-dried-earth': { family: 'surface', read: 'mud brick / adobe under a mud render: warm earth, low contrast', seenIn: ['Sumer', 'Indus', 'Egypt', 'Ancestral Puebloan', 'Yemen', 'Maghreb', 'West Africa'] },
  whitewash: { family: 'surface', read: 'white lime or gypsum coat on the important building', seenIn: ['Sumer', 'Mediterranean', 'Islamic world', 'Andalusia'] },
  'fired-brick': { family: 'surface', read: 'harder, redder brick for water and prestige', seenIn: ['Sumer (rare)', 'Indus', 'Rome', 'Song China', 'Hanseatic'] },
  reed: { family: 'surface', read: 'bundled reed and mat: straw-gold, arched or woven', seenIn: ['Sumer', 'Marsh Arabs', 'Lake Titicaca'] },

  // ── massing ──
  'flat-roof-cube': { family: 'massing', read: 'low box with a flat roof (a terrace to live on) and a small parapet', seenIn: ['Sumer', 'Indus', 'Egypt', 'Ancestral Puebloan', 'Yemen', 'Maghreb', 'Persia'] },
  'stepped-platform': { family: 'massing', read: 'stacked, receding stages with a long stair: the sacred mountain', seenIn: ['Sumer (ziggurat)', 'Egypt (step pyramid)', 'Mesoamerica', 'Java (Borobudur)'] },
  terrace: { family: 'massing', read: 'a raised, walled platform that lifts the sacred quarter above the town', seenIn: ['Sumer', 'Indus (citadel)', 'Mesoamerica', 'Greece (acropolis)'] },

  // ── facade ──
  'niched-wall': { family: 'facade', read: 'regular buttresses and recesses: a ribbed wall that catches the light', seenIn: ['Sumer', 'Egypt (palace facade)', 'Elam'] },
  'blank-wall': { family: 'facade', read: 'street walls nearly windowless; life faces the court', seenIn: ['Sumer', 'Islamic medina', 'Rome (domus)', 'China (hutong)'] },

  // ── plan ──
  'courtyard-house': { family: 'plan', read: 'rooms in a ring around an open court', seenIn: ['Sumer', 'Indus', 'Rome', 'Islamic world', 'China (siheyuan)', 'Spain'] },

  // ── layout ──
  'organic-lanes': { family: 'layout', read: 'dense blocks cut by meandering lanes and dead-end alleys', seenIn: ['Sumer', 'Islamic medina', 'medieval Europe', 'old Delhi'] },
  'sacred-precinct': { family: 'layout', read: 'a walled temple quarter at the heart, larger than everything around it', seenIn: ['Sumer', 'Egypt', 'Mesoamerica', 'Angkor', 'medieval cathedral close'] },
  'towered-wall': { family: 'layout', read: 'a thick ring wall with towers at intervals and gates where roads leave', seenIn: ['Sumer', 'Assyria', 'China', 'Rome', 'medieval Europe'] },
  'canal-through': { family: 'layout', read: 'a water street through the town, quays along it', seenIn: ['Sumer (Uruk)', 'Tenochtitlan', 'Venice', 'Amsterdam', 'Suzhou'] },
  'grove-fringe': { family: 'layout', read: 'gardens and tree groves pressing against the walls', seenIn: ['Sumer (date palm)', 'Egypt', 'Persia', 'Andalusia'] },

  // ── art: what a culture made to be looked at — placed at thresholds, on the sacred axis, in courts ──
  'votive-figures': { family: 'art', read: 'rows of standing worshippers, hands clasped, eyes wide, set before the god', seenIn: ['Sumer (Tell Asmar)', 'Egypt (ka statues)', 'Cyprus', 'archaic Greece (kouroi)'] },
  stele: { family: 'art', read: 'an upright slab, round-topped, carved in registers: a victory or a law set up in public', seenIn: ['Sumer', 'Akkad', 'Babylon', 'Egypt', 'Aksum', 'the Maya'] },
  'door-emblem': { family: 'art', read: "a god's sign standing either side of the door: posts, masts or banners that name the house", seenIn: ['Sumer (Inanna reed posts)', 'Egypt (pylon flagstaffs)', 'China (que towers)', 'Japan (torii)'] },
  guardians: { family: 'art', read: 'beasts or figures flanking a door or lining an approach', seenIn: ['Sumer (copper bulls)', 'Assyria (lamassu)', 'Egypt (sphinx avenue)', 'China (stone lions)'] },
  frieze: { family: 'art', read: 'a band of figures or beasts along the top of a wall, a great relief over the door', seenIn: ['Sumer (al-Ubaid)', 'Persia (Persepolis)', 'Greece (Parthenon)', 'Angkor'] },
  'mosaic-skin': { family: 'art', read: 'a wall or column wholly sheathed in small coloured pieces in bold geometric patterns', seenIn: ['Sumer (cone mosaic)', 'Byzantium', 'Islamic world (zellij)', 'Mitla (stone fret)'] },
  'ritual-vessel': { family: 'art', read: 'great jars and vases for offerings, set out at the door or before the altar', seenIn: ['Sumer (Uruk vase)', 'Greece (kraters)', 'Shang China (ding)'] },
  altar: { family: 'art', read: 'an offering table or fire basin before the sanctuary, on the axis', seenIn: ['Sumer', 'Israel', 'Greece', 'Rome', 'Mesoamerica'] },

  // ── street structures: what a neighbourhood needs to live — placed by need ──
  well: { family: 'street', read: 'a well head where lanes meet, a paved apron, a trough', seenIn: ['Sumer', 'Islamic medina', 'medieval Europe', 'Indus'] },
  kiln: { family: 'street', read: 'domed kilns at the town edge where the smoke goes, pots stacked by them', seenIn: ['Sumer', 'Indus', 'Greece (Kerameikos)', 'China'] },
  granary: { family: 'street', read: 'domed or long storehouses in a walled yard, the store of a temple or a ruler', seenIn: ['Sumer', 'Egypt', 'Indus (Harappa)', 'Inca (qollqa)'] },
  boat: { family: 'street', read: 'boats moored at the quay, the shape of the local hull', seenIn: ['Sumer (reed boats)', 'Egypt', 'Venice', 'Suzhou'] },

  // ── farm: what feeds the town — the countryside's tools at work and the buildings raised away from
  // the walls, placed by the work (the plough in the fallow, reapers at the standing crop's edge, the
  // threshing floor between the fields and the store) ──
  'strip-fields': { family: 'farm', read: 'long narrow fields running back from a canal or river, each watered from a channel at its head', seenIn: ['Sumer', 'Egypt (basin fields)', 'medieval Europe (open strips)', 'Song China'] },
  irrigation: { family: 'farm', read: 'channels on low banks leading water off the canal, sluices at their heads', seenIn: ['Sumer', 'Egypt', 'Indus', 'Peru (Chimú)', 'Persia (qanat-fed)'] },
  shaduf: { family: 'farm', read: 'a counterweighted lifting pole at the water\'s edge, raising buckets to the fields', seenIn: ['Mesopotamia (Akkad)', 'Egypt', 'India', 'medieval Europe (well sweep)'] },
  'plough-team': { family: 'farm', read: 'a yoked pair of oxen drawing a plough, the ploughman bent on the handles', seenIn: ['Sumer (seeder plough)', 'Egypt', 'Rome', 'medieval Europe', 'China'] },
  harvest: { family: 'farm', read: 'reapers bent into the standing crop, sheaves behind them, stooks drying', seenIn: ['Sumer (clay sickles)', 'Egypt', 'Rome', 'medieval Europe (scythe, later)'] },
  cart: { family: 'farm', read: 'a cart or wagon on solid or spoked wheels, drawn by oxen, donkeys or horses', seenIn: ['Sumer (solid wheels)', 'Indus', 'Rome', 'medieval Europe', 'China'] },
  'threshing-floor': { family: 'farm', read: 'a round of beaten earth where the sheaves are trodden or sledged, heaps of grain and chaff beside it', seenIn: ['Sumer', 'Egypt', 'Greece', 'the Levant', 'medieval Iberia'] },
  byre: { family: 'farm', read: 'a byre for the cattle, a pen before it, milking at its door', seenIn: ['Sumer (reed byre)', 'Egypt', 'Iron Age Europe (longhouse)', 'Alps'] },
  sheepfold: { family: 'farm', read: 'a fenced fold for the flock with a small shelter, the shepherd at its gate', seenIn: ['Sumer', 'the Levant', 'Greece', 'Britain'] },
  stable: { family: 'farm', read: 'a long shed of stalls for the draught beasts, mangers along its back', seenIn: ['Sumer (donkeys)', 'Egypt', 'Rome', 'medieval Europe'] },
  storehouse: { family: 'farm', read: 'a blind, sealed store for the harvest — the barn of a dry country — filled from its roof or door', seenIn: ['Sumer', 'Egypt', 'Indus', 'medieval Europe (tithe barn)'] },
  farmstead: { family: 'farm', read: 'a house and its yard in the fields: an oven, a shade, the household\'s crafts', seenIn: ['Sumer', 'Egypt', 'Rome (villa rustica)', 'medieval Europe'] },
  'tool-store': { family: 'farm', read: 'a shed of the farm\'s tools: hoes, sickles, shovels, the spare plough', seenIn: ['Sumer', 'Egypt', 'Rome', 'medieval Europe'] },  // works: where the tools and the building stuff are made, and from what
  'clay-pit': { family: 'works', read: 'a pit dug for clay by the water, its sides cut back, baskets carrying it out', seenIn: ['Sumer', 'Egypt', 'Indus', 'medieval brickfields'] },
  'brick-moulding': { family: 'works', read: 'clay and straw struck in a wooden mould, the bricks dried in rows, turned on edge, stacked in hacks', seenIn: ['Sumer', 'Egypt (Rekhmire)', 'Indus', 'the modern Middle East'] },
  'brick-kiln': { family: 'works', read: 'an updraft kiln of brick, fire tunnels below, the setting of green brick above', seenIn: ['Sumer', 'Indus', 'Rome', 'China'] },
  potters: { family: 'works', read: 'a shade over the wheel, pots drying in rows, settling tanks, a wasters heap, the kilns beside', seenIn: ['Sumer', 'Egypt', 'Greece (Kerameikos)', 'China'] },
  'metal-casting': { family: 'works', read: 'bowl hearths blown with pipes or bellows, crucibles, moulds, an anvil, charcoal and slag', seenIn: ['Sumer (blowpipes)', 'Egypt (Rekhmire)', 'Shang China', 'Benin'] },
  'charcoal-burning': { family: 'works', read: 'wood stacked and earthed over to char slowly, the clamp raked open black', seenIn: ['the Near East', 'Rome', 'medieval Europe', 'Japan'] },
  joinery: { family: 'works', read: 'logs, sawn planks, a bench with adze, saw and drill; a wheel or a boat taking shape', seenIn: ['Sumer', 'Egypt', 'Rome', 'medieval Europe'] },
  'stone-landing': { family: 'works', read: 'a quay where what the land lacks comes in by water: stone, timber, metal', seenIn: ['Sumer', 'Egypt (Aswan granite)', 'Venice', 'Amsterdam'] },
  'bitumen-works': { family: 'works', read: 'bitumen cooked with sand and straw into a mastic for mortar, caulking and waterproofing', seenIn: ['Sumer', 'Elam', 'the Indus (Mohenjo-daro)'] },
  'reed-working': { family: 'works', read: 'reed cut, bundled, dried in stooks, plaited into mats and twisted into rope', seenIn: ['Sumer and the Iraqi marshes', 'Egypt (papyrus)', 'Lake Titicaca (totora)'] },
};

/** A flat-roofed cube with a low parapet lip. */
export function flatRoofCube({ x, y, w, d }, h, tint, kind = 'house', parapet = 0.4) {
  const out = [{ kind, x, y, w, d, z0: 0, z1: h, tint }];
  if (parapet > 0 && w > 2 && d > 2) {
    const t = 0.35, z0 = h, z1 = h + parapet;
    out.push(
      { kind: `${kind}-parapet`, x, y, w, d: t, z0, z1, tint },
      { kind: `${kind}-parapet`, x, y: y + d - t, w, d: t, z0, z1, tint },
      { kind: `${kind}-parapet`, x, y: y + t, w: t, d: d - 2 * t, z0, z1, tint },
      { kind: `${kind}-parapet`, x: x + w - t, y: y + t, w: t, d: d - 2 * t, z0, z1, tint },
    );
  }
  return out;
}

/** Rooms in a ring around an open court; the court is returned as ground. */
export function courtyardHouse({ x, y, w, d }, h, tint, depth = 3.2, parapet = 0.4) {
  const k = Math.min(depth, w / 3, d / 3);
  const boxes = [
    ...flatRoofCube({ x, y, w, d: k }, h, tint, 'house', parapet),
    ...flatRoofCube({ x, y: y + d - k, w, d: k }, h, tint, 'house', parapet),
    ...flatRoofCube({ x, y: y + k, w: k, d: d - 2 * k }, h, tint, 'house', parapet),
    ...flatRoofCube({ x: x + w - k, y: y + k, w: k, d: d - 2 * k }, h, tint, 'house', parapet),
  ];
  return { boxes, court: { x: x + k, y: y + k, w: w - 2 * k, d: d - 2 * k } };
}

/** Regular buttresses along every side of a mass: the niched read. */
export function nichedWall({ x, y, w, d }, z0, z1, tint, { pitch = 2.4, depth = 0.45, width = 0.9 } = {}) {
  const out = [];
  const along = (len, at) => { const n = Math.max(2, Math.floor(len / pitch)); const step = len / n; for (let i = 0; i <= n; i++) at(i * step - width / 2); };
  along(w, (u) => {
    const ux = Math.max(x, Math.min(x + w - width, x + u));
    out.push({ kind: 'buttress', x: ux, y: y - depth, w: width, d: depth, z0, z1, tint }, { kind: 'buttress', x: ux, y: y + d, w: width, d: depth, z0, z1, tint });
  });
  along(d, (v) => {
    const vy = Math.max(y, Math.min(y + d - width, y + v));
    out.push({ kind: 'buttress', x: x - depth, y: vy, w: depth, d: width, z0, z1, tint }, { kind: 'buttress', x: x + w, y: vy, w: depth, d: width, z0, z1, tint });
  });
  return out;
}

/** Stacked receding stages, a central stair up the front (−y) side, buttressed faces. */
export function steppedPlatform({ x, y, w, d }, { stages = 3, height = 20, inset = 0.16, tint, stairTint, niched = true }) {
  const out = [];
  let r = { x, y, w, d }, z = 0;
  const hs = [0.5, 0.3, 0.2, 0.15, 0.1].slice(0, stages), tot = hs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < stages; i++) {
    const zh = (height * hs[i]) / tot;
    out.push({ kind: 'platform', ...r, z0: z, z1: z + zh, tint });
    if (niched) out.push(...nichedWall(r, z, z + zh * 0.92, tint, { pitch: 3.2 }));
    z += zh;
    const ix = r.w * inset / 2, iy = r.d * inset / 2;
    r = { x: r.x + ix, y: r.y + iy, w: r.w - 2 * ix, d: r.d - 2 * iy };
  }
  // the stair: a ramp of thin steps from the ground to the top stage, centred on the front
  const sw = Math.max(3, w * 0.1), run = d * 0.55, steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    out.push({ kind: 'stair', x: x + w / 2 - sw / 2, y: y - run * (1 - t) + 0.01, w: sw, d: run / steps + 0.05, z0: 0, z1: z * (t + 1 / steps), tint: stairTint || tint });
  }
  return { boxes: out, top: { ...r, z } };
}

/**
 * A date palm, metres: a low-poly solid (assets/solids.js `palm`) — a slim leaning trunk under a
 * crown of long drooping fronds and a few short rising ones. The grown palm read as a broadleaf
 * blob from the air and cost ~900 faces each.
 */
export function palm(x, y, rng) {
  const h = 9 + rng() * 5, la = rng() * 6.283, lean = 0.04 + rng() * 0.08, n = 9 + Math.floor(rng() * 3), a0 = rng() * 6.283;
  const fronds = Array.from({ length: n }, (_, i) => ({ a: a0 + (i / n) * 6.283 + (rng() - 0.5) * 0.3, len: 0.36 + rng() * 0.1, droop: 0.34 + rng() * 0.26 }));   // the sheet's fronds hang steeply
  for (let i = 0; i < 3; i++) fronds.push({ a: rng() * 6.283, len: 0.26, droop: -0.12 });   // the young fronds rising from the heart
  const dates = rng() < 0.7 ? 1 + Math.floor(rng() * 3) : 0;   // orange date clusters under the crown
  return { kind: 'palm', solid: 'palm', dates, x: x - 0.7, y: y - 0.7, w: 1.4, d: 1.4, z0: 0, z1: h, lean: [Math.cos(la) * lean, Math.sin(la) * lean], fronds, tint: '#6d7d43', trunkTint: '#86745a' };
}
