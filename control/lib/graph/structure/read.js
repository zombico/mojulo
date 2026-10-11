/**
 * structure/read — everything the structure book shows, read from a floorplan manifest (the recipe), tagged.
 *
 * The house kernel computes a full building on every read and keeps only its faces: the world drops the element
 * model, the furniture as data, the frame's reports, the construction model, the rainwater. This reader asks the
 * same kernel for the same building (`structurizeHouse` / `structurizeFloorplan`, exactly as the World and the IFC
 * export build it) with two collectors that ride beside the faces (`_objects`, `_spans`), and returns the building as
 * data: rooms, elements (what the structure is made of) and objects (what it holds), each with one tag
 * (structure/tags.js), plus the schedules, grade, design checks and, framed, the construction model.
 *
 * A house is one program among several (structure/programs.js): a store, a restaurant and a mall are read the same
 * way from their own kernels, named by what their rooms are for and graded by their program's rules, never as a home.
 * Their read carries `occupancy`; a house's read is exactly what it always was.
 *
 * Pure: the same manifest gives the same read. It adds nothing to any world, GLB or IFC (the collectors are read
 * only here). Feet, like every floorplan number (`units`).
 */

import { structurizeHouse, structurizeFloorplan, storeyLevels, FLOORPLAN_DEFAULTS, FLOORPLAN_UNITS, STAIR_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { buildElementModel, deriveSchedules, scoreHouse } from '../polygonizer/floorplan-bim.js';
import { designRules } from '../polygonizer/floorplan-design.js';
import { resolveTier } from '../polygonizer/floorplan-glyphs.js';
import { roofPlanes, ROOF_STYLES } from '../architecture/roof.js';
import { buildPerimeter } from '../polygonizer/floorplan-perimeter.js';
import { planHouseFraming, framingOf } from '../construction/house-frame.js';
import { readFraming, readWiring, readDrainage } from './trades.js';
import { tagRooms, tagDoors, tagTypes, windowKey, wallKey, objectCode, tagObjectTypes, storeyNumber, inches } from './tags.js';
import { occupancyOf, buildProgram, nameSpacesByRole, programGrade } from './programs.js';

const r2 = (n) => Math.round(n * 100) / 100;

/** Is this manifest a stack (a house of storeys) or the single floor it always was? */
export function isStacked(m = {}) {
  return (Array.isArray(m.levels) && m.levels.length > 0) || !!storeyLevels(m);
}

/** Build the building once with the collectors on. The exterior view hides the basement and the furniture; the read
 *  wants the whole building, so it reads the cutaway (the view changes the camera and what is drawn, never the plan). */
function build(m) {
  const objects = [], spans = {};
  const view = m.view === 'exterior' ? 'cutaway' : m.view;
  // a stack is always walked (the design report reads the floor; only `repair` and `clearance` change it, and those
  // come from the recipe), so the book can say where a passage pinches whether or not the recipe asked
  const stack = (Array.isArray(m.levels) && m.levels.length) || storeyLevels(m);
  const opts = { ...m, view, walk: false, _model: true, _objects: objects, _spans: spans, ...(stack && !m.design ? { design: {} } : {}) };
  if (Array.isArray(m.levels) && m.levels.length) return { house: structurizeHouse(m, opts), objects, spans, stacked: true, opts };
  if (stack) return { house: structurizeHouse({ ...m, ...stack }, opts), objects, spans, stacked: true, opts };
  const s = structurizeFloorplan(m, opts);
  const house = {
    footprint: s.footprint, lot: s.lot, stairs: [],
    levels: [{ index: 0, role: 'ground', baseZ: s.baseZ ?? 0, height: opts.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight, structure: { wallGraph: s.wallGraph, cells: s.cells, slabHoles: s.slabHoles || [] } }],
  };
  return { house, objects, spans, stacked: false, opts };
}

const midOf = (wall, op) => {
  const s = (op.a + op.b) / 2;
  return wall.orientation === 'h' ? { x: s, y: wall.at } : { x: wall.at, y: s };
};

const rectOf = (h) => ({ x: r2(h.x0), y: r2(h.y0), w: r2(h.x1 - h.x0), h: r2(h.y1 - h.y0) });
const inRect = (p, f, tol = 0.01) => p.x >= f.x - tol && p.x <= f.x + f.w + tol && p.y >= f.y - tol && p.y <= f.y + f.h + tol;

const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };

/**
 * A stair's flights and landing in plan, as the kernel builds them (floorplan-structure.js buildStairFlight /
 * buildSwitchbackFlight): from its anchor along its direction, the first flight in the band [0, w] across it; a
 * switchback turns on a half-landing a stair-width deep and climbs back in [w + gap, 2w + gap].
 * → { flights: [{ rect, climb: [dx, dy], z0, z1, steps }], landing?: { rect, z } }
 */
function flightsOf(st) {
  if (!st || !st.anchor || !st.slot) return null;
  const dir = DIRS[st.direction] || DIRS['+x'], perp = [-dir[1], dir[0]];
  const [ax, ay] = st.anchor;
  const P = (a, off) => [ax + dir[0] * a + perp[0] * off, ay + dir[1] * a + perp[1] * off];
  const R = (a0, a1, o0, o1) => { const A = P(a0, o0), B = P(a1, o1); return rectOf({ x0: Math.min(A[0], B[0]), x1: Math.max(A[0], B[0]), y0: Math.min(A[1], B[1]), y1: Math.max(A[1], B[1]) }); };
  const zTop = st.topZ, z0 = st.topZ - st.steps * st.rise;
  const short = Math.min(st.slot.x1 - st.slot.x0, st.slot.y1 - st.slot.y0);
  if (st.switchback) {
    const gap = STAIR_DEFAULTS.wellGap, w = (short - gap) / 2, run = st.runLength, m = st.steps / 2, zMid = z0 + m * st.rise;
    return {
      flights: [
        { rect: R(0, run, 0, w), climb: dir, z0: r2(z0), z1: r2(zMid), steps: m },
        { rect: R(0, run, w + gap, 2 * w + gap), climb: [-dir[0], -dir[1]], z0: r2(zMid), z1: r2(zTop), steps: m },
      ],
      landing: { rect: R(run, run + w, 0, 2 * w + gap), z: r2(zMid) },
    };
  }
  return { flights: [{ rect: R(0, st.runLength, 0, short), climb: dir, z0: r2(z0), z1: r2(zTop), steps: st.steps }] };
}

/** The finished roof's planes (as the IFC export reads them), or null when the house has no roof. */
function roofOf(m, house, o) {
  if (!m.roof) return null;
  const spec = typeof m.roof === 'object' ? { style: m.roof.style || 'bungalow', ...m.roof } : { style: typeof m.roof === 'string' ? m.roof : 'bungalow' };
  const st = { ...(ROOF_STYLES[spec.style] || ROOF_STYLES.bungalow), ...spec };
  const fp = house.footprint;
  const top = [...house.levels].sort((a, b) => b.index - a.index)[0];
  const planes = roofPlanes({ x: fp.x0, y: fp.y0, w: fp.x1 - fp.x0, d: fp.y1 - fp.y0, z: top.baseZ + top.height }, { ...spec, roomHeight: o.wallHeight });
  return { style: spec.style, form: st.form ?? null, pitch: st.pitch ?? null, covering: spec.covering ?? null, planes: planes.map((p) => ({ key: p.key, corners: p.corners.map((c) => c.map(r2)) })) };
}

/** Each placed piece as a plan rect on its storey: a room's furniture (composed, archetype, constructed) and the
 *  operator's own `items` (a type, or a `ref` to another sketch). */
function objectsOf(collected) {
  const out = [];
  for (const c of collected) {
    if (c.source === 'item') {
      for (const p of c.placed) {
        const r = p.rect;
        const rect = { x: r2(r.x0), y: r2(r.y0), w: r2(r.x1 - r.x0), h: r2(r.y1 - r.y0) };
        if (p.ref) out.push({ source: 'ref', type: 'ref', ref: p.ref.ref, name: p.name, baseZ: c.baseZ, rect, facing: p.facing });
        else out.push({ source: 'item', type: p.element.type, asset: p.element.asset ?? null, name: p.name, baseZ: c.baseZ, rect, facing: p.facing });
      }
      continue;
    }
    const { x0, x1, y0, y1 } = c.interior;
    const W = x1 - x0, H = y1 - y0;
    for (const e of c.elements) {
      const u = e.anchor ? e.anchor[0] : 0.5, v = e.anchor ? e.anchor[1] : 0.5;
      const ew = (e.w || 0.12) * W, eh = (e.h || 0.12) * H;
      const cx = x0 + u * W, cy = y0 + v * H;
      out.push({
        source: c.source, type: e.type, asset: e.asset ?? null,
        ...(e.compose ? { like: e.compose.like } : {}),
        baseZ: c.baseZ, rect: { x: r2(cx - ew / 2), y: r2(cy - eh / 2), w: r2(ew), h: r2(eh) },
        ...(e.facing != null ? { facing: e.facing } : {}),
      });
    }
  }
  return out;
}

/**
 * readStructure(manifest) → the building as tagged data:
 * { units, title, footprint, storeys, rooms, elements: { walls, wallTypes, doors, windows, windowTypes, slabs, stairs,
 *   roof }, objects: { pieces, types }, schedules, grade, design?, construction? (with frames and memberTypes),
 *   wiring?, drainage?, lot? }
 * A commercial program (store, restaurant, mall) adds `occupancy` and `elements.verticals`, and has no `program`,
 * `dwelling`, roof, site or construction. Null for a manifest the book does not read.
 */
export function readStructure(m = {}) {
  const occ = occupancyOf(m);
  if (!occ) return null;
  const isHouse = occ.id === 'house';
  const P = isHouse ? null : buildProgram(m);
  const o = isHouse ? { ...FLOORPLAN_DEFAULTS, ...m } : P.opts;
  const { house, objects: collected, spans, stacked, opts } = isHouse ? build(m) : { ...P, spans: {} };
  const model = buildElementModel(house, o);
  if (!isHouse) nameSpacesByRole(model);
  const schedules = deriveSchedules(model);
  // a commercial building's egress is its exits (reachability), and its adjacency is its program's rules, not a home's
  if (!isHouse) { schedules.egress = []; schedules.adjacency = []; }
  const grade = isHouse ? scoreHouse(model) : programGrade(model, schedules, occ, P.extra);

  const storeyIndex = new Map(model.storeys.map((s) => [s.id, s.index]));
  const storeys = model.storeys.map((s) => ({ id: s.id, index: s.index, number: storeyNumber(s.index), role: s.role, baseZ: r2(s.baseZ ?? 0), height: r2(s.height) }));

  // ── rooms ──
  const roomTag = tagRooms(model.spaces, (sid) => storeyIndex.get(sid));
  const spaceById = new Map(model.spaces.map((s) => [s.id, s]));
  const isCirc = (id) => { const s = spaceById.get(id); return !!s && (s.glyph === 'H' || s.kind === 'hall' || s.role === 'circulation'); };

  // ── walls and their types ──
  const wallTypes = tagTypes(model.walls, wallKey, (i) => String(i + 1));
  let wallSeq = 0;
  const wallTag = new Map(model.walls.map((w) => [w.id, `W${++wallSeq}`]));
  const walls = model.walls.map((w) => ({
    tag: wallTag.get(w.id), type: wallTypes.typeOf.get(w.id), id: w.id, storey: storeyIndex.get(w.storey),
    orientation: w.orientation, at: r2(w.at), along: w.along.map(r2), length: w.length, thickness: r2(w.thickness),
    interior: w.interior, exteriorSide: w.exteriorSide, bounds: w.bounds.map((id) => roomTag.get(id)).filter(Boolean),
  }));

  // ── openings: doors by the room they serve, windows by type ──
  const wallById = new Map(model.walls.map((w) => [w.id, w]));
  const located = model.openings.map((op) => {
    const w = wallById.get(op.host);
    // the element model keeps an opening's start only in its id (`open:<wall>:<a>`); its width gives the end
    const a = Number(op.id.slice(op.id.lastIndexOf(':') + 1));
    return { ...op, at: midOf(w, { a, b: a + op.width }) };
  });
  const doorsRaw = located.filter((x) => x.type === 'door');
  const windowsRaw = located.filter((x) => x.type === 'window');
  const doorTags = tagDoors(doorsRaw, roomTag, isCirc);
  const windowTypes = tagTypes(windowsRaw, windowKey);
  let winSeq = 0;
  const opening = (x, extra) => ({
    id: x.id, host: wallTag.get(x.host), storey: storeyIndex.get(x.storey), width: x.width, height: x.height, sill: r2(x.sill),
    exterior: x.exterior, at: { x: r2(x.at.x), y: r2(x.at.y) },
    connects: x.connects.map((id) => roomTag.get(id)).filter(Boolean), ...extra,
  });
  const doors = doorsRaw.map((x) => opening(x, { tag: doorTags.get(x.id).tag, serves: roomTag.get(doorTags.get(x.id).serves) ?? null, entry: x.entry }));
  const windows = windowsRaw.map((x) => opening(x, { tag: windowTypes.typeOf.get(x.id), mark: `WN${++winSeq}` }));

  // ── objects ──
  const pieces0 = isHouse ? objectsOf(collected) : collected;
  const storeyAt = (z) => model.storeys.reduce((best, s) => (Math.abs((s.baseZ ?? 0) - z) < Math.abs((best.baseZ ?? 0) - z) ? s : best), model.storeys[0]);
  const keyOf = (p) => (p.source === 'ref' ? `ref:${p.ref}` : `${p.type}|${p.like ?? p.asset ?? ''}`);
  const codeOf = (p) => (p.source === 'ref' ? 'RF' : p.code ?? objectCode(p.type));
  const typeTag = tagObjectTypes(pieces0.map((p) => ({ key: keyOf(p), code: codeOf(p) })));
  const pieces = pieces0.map((p, i) => {
    const st = storeyAt(p.baseZ);
    const c = { x: p.rect.x + p.rect.w / 2, y: p.rect.y + p.rect.h / 2 };
    const room = model.spaces.find((s) => s.storey === st.id && inRect(c, s.footprint));
    const { baseZ: _z, ...rest } = p;
    return { mark: `OB${i + 1}`, tag: typeTag.get(keyOf(p)), ...rest, storey: st.index, room: room ? roomTag.get(room.id) : null };
  });
  const objectTypes = [...new Set(pieces.map((p) => p.tag))].sort().map((tag) => {
    const of = pieces.filter((p) => p.tag === tag);
    const p = of[0];
    return { tag, source: p.source, type: p.type, ...(p.like ? { like: p.like } : {}), ...(p.asset ? { asset: p.asset } : {}), ...(p.ref ? { ref: p.ref } : {}), count: of.length, rooms: [...new Set(of.map((x) => x.room).filter(Boolean))].sort() };
  });

  // ── rooms as cards: their bounding elements, openings and objects ──
  const rooms = model.spaces.map((s) => {
    const tag = roomTag.get(s.id);
    return {
      tag, id: s.id, storey: storeyIndex.get(s.storey), name: s.name, role: s.role, glyph: s.glyph ?? null,
      rect: { x: r2(s.footprint.x), y: r2(s.footprint.y), w: r2(s.footprint.w), h: r2(s.footprint.h) }, area: s.area,
      needsWindow: s.needsWindow,
      walls: s.bounds.map((id) => wallTag.get(id)),
      doors: doors.filter((d) => d.connects.includes(tag)).map((d) => d.tag),
      windows: windows.filter((w) => w.connects.includes(tag)).map((w) => w.mark),
      objects: pieces.filter((p) => p.room === tag).map((p) => p.mark),
      connects: s.connects.map((id) => roomTag.get(id)).filter(Boolean),
    };
  }).sort((a, b) => (a.storey - b.storey) || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  // ── the program a generated stack is built to: its open core (living, kitchen, dining share one room, which the
  // kernel names the lounge) and its bedrooms, asked and built, so the book names the core and says when fewer fit ──
  const authored = (Array.isArray(m.rooms) && m.rooms.length) || (Array.isArray(m.levels) && m.levels.some((l) => l && Array.isArray(l.rooms) && l.rooms.length));
  let program = null;
  if (isHouse && stacked && !authored && m.program !== false) {
    const t = resolveTier(m.tier);
    const has = (g) => rooms.some((r) => r.glyph === g);
    const core = (t.core || ['L']).filter((g) => g === 'L' || !has(g));
    if (core.length > 1) {
      const coreName = ['living', ...(core.includes('K') ? ['kitchen'] : []), ...(core.includes('D') ? ['dining'] : [])].join(' / ');
      for (const r of rooms) if (r.glyph === 'L') r.name = coreName;
    }
    const twoUp = storeys.length > 1;
    program = {
      core,
      beds: { asked: t.beds, built: rooms.filter((r) => r.glyph === 'B').length },
      study: !!t.study,
      // the generator gives a study the last bedroom slot upstairs once a house asks three or more
      studyTakesBed: twoUp && !!t.study && t.beds >= 3,
      given: m.tier !== undefined,
    };
  }

  // ── a room or a house. One space (halls aside) is a room: a showroom, a set, a studio piece; it is furnished and
  // walked, never judged as a home. More is a house, and a house is livable only with a kitchen (its own room, or the
  // open core's), a bathroom and a bedroom ──
  // a commercial program is a building, judged by its program's rules, never as a home
  const subject = !isHouse ? 'building' : rooms.filter((r) => r.glyph !== 'H').length <= 1 ? 'room' : 'house';
  let dwelling = null;
  if (subject === 'house') {
    const has = { kitchen: rooms.some((r) => r.glyph === 'K') || !!program?.core.includes('K'), bathroom: rooms.some((r) => r.glyph === 'W'), bedroom: rooms.some((r) => r.glyph === 'B') };
    dwelling = { ...has, missing: Object.keys(has).filter((k) => !has[k]) };
  }

  const elements = {
    walls,
    wallTypes: wallTypes.types.map((t) => {
      const ws = walls.filter((w) => w.type === t.type);
      return { type: t.type, interior: ws[0].interior, thickness: ws[0].thickness, count: ws.length, length: r2(ws.reduce((a, w) => a + w.length, 0)) };
    }),
    doors,
    windows,
    windowTypes: windowTypes.types.map((t) => {
      const w = windows.find((x) => x.tag === t.type);
      // nominal, in whole inches: what the type was keyed on (each window keeps its fitted size, in feet, on its own row)
      return { type: t.type, widthIn: inches(w.width), heightIn: inches(w.height), sillIn: inches(w.sill), count: t.ids.length };
    }),
    slabs: model.slabs.map((s) => ({ tag: `SL${storeyNumber(storeyIndex.get(s.storey))}`, storey: storeyIndex.get(s.storey), area: s.area, holes: s.holes.map(rectOf) })),
    // a stair's slot is the void it rises through in the upper slab; the flight stands under it
    stairs: model.stairs.map((s, i) => {
      // the kernel's own flight (its steps, rise, run and turn), matched by the void it rises through
      const k = (house.stairs || []).find((h) => h.slot && s.slot && Math.abs(h.slot.x0 - s.slot.x0) < 1e-6 && Math.abs(h.slot.y0 - s.slot.y0) < 1e-6 && h.fromIndex === storeyIndex.get(s.fromStorey));
      const fl = flightsOf(k);
      return {
        tag: `ST${i + 1}`, from: storeyIndex.get(s.fromStorey), to: storeyIndex.get(s.toStorey), ...(s.slot ? { slot: rectOf(s.slot) } : {}),
        ...(k ? { risers: k.steps, rise: r2(k.rise), going: r2(k.going), switchback: !!k.switchback } : {}), ...(fl || {}),
        // the width built: a flight's short side (stairs[].width; design.stair.width is the rule it is checked against)
        ...(fl?.flights?.length ? { width: r2(Math.min(...fl.flights.map((f) => Math.min(f.rect.w, f.rect.h)))) } : {}),
      };
    }),
    roof: isHouse ? roofOf(m, house, o) : null,
    // the escalators and lifts a commercial stack climbs by (a house climbs by its stairs)
    ...(!isHouse && model.verticals.length ? { verticals: model.verticals.map((v, i) => ({ tag: `${v.kind === 'elevator' ? 'EL' : 'ES'}${i + 1}`, kind: v.kind, from: storeyIndex.get(v.fromStorey), to: storeyIndex.get(v.toStorey), links: [...v.links.lower, ...v.links.upper].map((id) => roomTag.get(id)).filter(Boolean) })) } : {}),
  };

  const fp = house.footprint;
  const out = {
    units: FLOORPLAN_UNITS, title: m.title ?? null, stacked,
    ...(!isHouse ? { occupancy: { id: occ.id, label: occ.label, group: occ.group, name: occ.name } } : {}),
    footprint: fp ? { x0: r2(fp.x0), y0: r2(fp.y0), x1: r2(fp.x1), y1: r2(fp.y1) } : null,
    subject, storeys, rooms, elements,
    ...(program ? { program } : {}),
    ...(dwelling ? { dwelling } : {}),
    objects: { pieces, types: objectTypes },
    schedules: {
      ...schedules,
      // schedules keyed by space id as the element model keys them; the book reads them by room tag
      rooms: rooms.map((r) => ({ tag: r.tag, name: r.name, storey: r.storey, area: r.area })),
      grossArea: r2(rooms.reduce((a, r) => a + r.area, 0)),
    },
    grade,
    ...(house.design ? { design: house.design } : {}),
    // the house's design rules as the recipe sets them (floorplan-design.js): the passage, the stair clearance, the waivers
    rules: designRules(m.design, m.framing ? framingOf(m.framing).tradition : null),
    ...(house.lot ? { lot: house.lot } : {}),
    floorDrop: r2(o.floorDrop),
  };
  // the site: the lot and what stands on it, as the perimeter builds them (its rects; the faces are the World's)
  if (isHouse && m.perimeter && fp) {
    const peri = buildPerimeter(fp, 0, typeof m.perimeter === 'object' ? m.perimeter : {});
    const rect = (r) => (r ? { x0: r2(r.x0), y0: r2(r.y0), x1: r2(r.x1), y1: r2(r.y1) } : null);
    out.site = {
      lot: { ...peri.lot, x0: r2(peri.lot.x0), y0: r2(peri.lot.y0), x1: r2(peri.lot.x1), y1: r2(peri.lot.y1) },
      ...Object.fromEntries(['drive', 'carport', 'garage', 'path', 'patio', 'shed'].map((k) => [k, rect(peri[`${k}Rect`])]).filter(([, v]) => v)),
    };
  }
  if (isHouse && (house.framing || house.construction)) {
    out.construction = {
      ...(house.framing ? { report: house.framing } : {}),
      ...(house.construction ? { summary: house.construction.summary, schedules: house.construction.schedules, checks: house.construction.checks } : {}),
      spans,
    };
  }
  // the trades as data (structure/trades.js): the frame's members and fields, the wiring, the rainwater
  if (isHouse && house.framing && m.framing) {
    const fo = { ...o, ...opts };
    const plan = planHouseFraming(house, m.framing, fo);
    const fr = readFraming(house, m.framing, fo, plan);
    out.construction.system = fr.system;
    out.construction.tradition = fr.tradition;
    out.construction.stage = fr.stage;
    out.construction.frames = fr.frames;
    out.construction.memberTypes = fr.types;
    // the wiring names a room by its cell (`L0:35.406,23`); the element model keys the same room by its rounded corner
    const cellRoom = (id) => {
      const c = /^L(-?\d+):(-?[\d.]+),(-?[\d.]+)$/.exec(id);
      if (!c) return roomTag.get(id) ?? null;
      const s = model.spaces.find((sp) => storeyIndex.get(sp.storey) === Number(c[1]) && Math.abs(sp.footprint.x - Number(c[2])) < 0.01 && Math.abs(sp.footprint.y - Number(c[3])) < 0.01);
      return s ? roomTag.get(s.id) : null;
    };
    const wiring = readWiring(house, m.framing, plan.frames, fo, cellRoom);
    if (wiring) out.wiring = wiring;
  }
  if (isHouse && m.drainage && stacked) {
    const dr = readDrainage(house, m.drainage, { ...o, ...opts, tradition: m.framing ? framingOf(m.framing).tradition : null });
    if (dr) out.drainage = dr;
  }
  return out;
}
