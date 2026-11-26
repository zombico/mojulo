/**
 * THE OPERATION'S BRIEFING — a frame level told on the holo table before the drop, as Rebel Storm's missions and Wolf
 * Squadron's stages are (briefing.js, briefing-page.js): the field's own ground as the table's terrain, the drop, every
 * group of the operation stood up where it stands as a miniature (holo-minis.js), each beacon a ring, and the briefing
 * told a step at a time, each step lighting what it is about and drawing the way to it.
 *
 *   readOperationBriefing(v, ids, at?) → { region?, steps: [{ title, say, show: [ids], routes: [[from, to]] }] } (throws,
 *                                       teaching): an operation's `briefing` (frame-goal.js), its ids the groups', `drop`
 *                                       and `beacon-<n>` (the reach task it lights, counted from 1)
 *   operationBriefingData(G, id)       → the briefing page's data (briefing.js's shape: place, orrery, theatre with its
 *                                       terrain, things, steps, roster, goals); the steps the operation's own design, else
 *                                       a step for the field and one a task
 *   OPERATION_BRIEF                    the table's numbers: the terrain's samples a side, how much it stretches heights,
 *                                       the most of a works' masses it stands
 *
 * The table's frame: the field's middle its origin, x east, y north (the drop is south of the middle, facing north), z up
 * from the field's lowest ground. Pure: the same world, the same table (frame-map.js reads the same field and places).
 */
import { frameMapData } from '../gameworld/frame-map.js';
import { resolveLevel } from '../gameworld/world.js';
import { frameLevelManifest } from '../gameworld/levels.js';
import { frameField } from '../assault-frame/field.js';
import { readOperation } from '../gameworld/frame-goal.js';
import { orrery, readPlace } from './theatre.js';
import { groundMini } from './holo-minis.js';
import { GROUND_UNITS } from '../groundforce/index.js';
import { ACES } from '../assault-frame/aces.js';
import { MTS } from '../assault-frame/mts.js';

const r1 = (v) => Math.round(v * 10) / 10;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const OPERATION_BRIEF = Object.freeze({ samples: 84, vertical: 1.2, title: 64, say: 280, steps: 8, masses: 400 });

/** A group's words: its name, and what it is (its count and kind). */
const nameOfId = (id) => id.split('-').map((w) => w.replace(/^\w/, (c) => c.toUpperCase())).join(' ');
function groupWords(g) {
  if (g.kind === 'frame') {
    if (g.ace) return { name: ACES[g.ace].name, label: 'the warlord\'s ace' };
    if (g.mt) return { name: nameOfId(g.id), label: `${g.count} ${MTS[g.mt].name ?? g.mt} MT${g.count === 1 ? '' : 's'}` };
    return { name: nameOfId(g.id), label: `${g.count} enemy frame${g.count === 1 ? '' : 's'}` };
  }
  const L = GROUND_UNITS[g.kind]?.label ?? g.kind;
  return { name: nameOfId(g.id), label: `${g.count} ${L}${g.count === 1 ? '' : 's'}` };
}

export function readOperationBriefing(v, ids, at = 'operation.briefing') {
  const fail = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) fail(' is { region?, steps: [{ title, say, show?, routes? }] }: the operation told on the holo table');
  for (const k of Object.keys(v)) if (!['region', 'steps'].includes(k)) fail(`.${k} is not part of a briefing (region, steps)`);
  if (v.region !== undefined && !(typeof v.region === 'string' && /^[A-Z][A-Za-z' -]{1,31}$/.test(v.region))) fail('.region is the place\'s name, capitalised (Tharsis, Valles Marineris)');
  if (!Array.isArray(v.steps) || !v.steps.length || v.steps.length > OPERATION_BRIEF.steps) fail(`.steps is 1 to ${OPERATION_BRIEF.steps} steps, each told on the table`);
  const known = new Set(ids);
  const steps = v.steps.map((s, i) => {
    const sat = `${at}.steps[${i}]`;
    if (!isObj(s)) throw new Error(`${sat} is { title, say, show?, routes? }`);
    for (const k of Object.keys(s)) if (!['title', 'say', 'show', 'routes'].includes(k)) throw new Error(`${sat}.${k} is not part of a step (title, say, show, routes)`);
    if (!(typeof s.title === 'string' && s.title.length && s.title.length <= OPERATION_BRIEF.title)) throw new Error(`${sat}.title is its heading, up to ${OPERATION_BRIEF.title} letters`);
    if (!(typeof s.say === 'string' && s.say.length && s.say.length <= OPERATION_BRIEF.say)) throw new Error(`${sat}.say is what the briefing says, up to ${OPERATION_BRIEF.say} letters`);
    const show = s.show ?? [], routes = s.routes ?? [];
    for (const id of show) if (!known.has(id)) throw new Error(`${sat}.show names '${id}': one of ${[...known].join(', ')}`);
    for (const r of routes) if (!(Array.isArray(r) && r.length === 2 && r.every((id) => known.has(id)))) throw new Error(`${sat}.routes are [from, to] pairs of ${[...known].join(', ')}`);
    return { title: s.title, say: s.say, show: [...show], routes: routes.map((r) => [...r]) };
  });
  return { ...(v.region ? { region: v.region } : {}), steps };
}

// a task's words, as the objectives say it
const taskText = (t, op) => t.text ?? (t.down ? `Destroy: ${t.down.map((id) => groupWords(op.groups.find((g) => g.id === id)).name).join(', ')}` : t.reach ? 'Move to the beacon' : `Hold for ${t.hold} s`);

export function operationBriefingData(G, id) {
  const L = G.levels[id], D = frameMapData(G, id), raw = L.goal.operation, op = readOperation(raw);
  const [cx, cy] = D.field.centre, [bx0, by0, bx1, by1] = D.field.bound;
  // (the table's ground: the field's land sampled a side, its heights in decimetres over its lowest)
  const n = OPERATION_BRIEF.samples, dx = (bx1 - bx0) / (n - 1), hs = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs.push(D.heightAt(bx0 + i * dx, by0 + j * dx));
  const floor = Math.min(...hs), z = hs.map((h) => Math.round((h - floor) * 10));
  const at = (p) => [r1(p[0] - cx), r1(p[1] - cy), r1((p[2] ?? floor) - floor)];
  const drop = at(D.spawn);
  // (a works' field, under a roof: its machines, decks, furnaces and racks stood on the table as masses, its hall's own
  // walls left off so the table is seen into; the land's other fields have none)
  const W = frameField(frameLevelManifest(resolveLevel(G, id)).cube).colliders ?? [], span = bx1 - bx0;
  const masses = W.filter((c) => Math.max(c.max[0] - c.min[0], c.max[1] - c.min[1]) < span * 0.7).slice(0, OPERATION_BRIEF.masses)
    .map((c) => [r1((c.min[0] + c.max[0]) / 2 - cx), r1((c.min[1] + c.max[1]) / 2 - cy), r1(Math.max(0, c.min[2] - floor)), r1(c.max[0] - c.min[0]), r1(c.max[1] - c.min[1]), r1(c.max[2] - Math.max(c.min[2], floor))]);
  // (each group where its members stand: their middle, their count)
  const things = [{ id: 'drop', name: 'Your frame', side: 'friend', kind: 'group', label: 'the drop', at: drop, heading: 0, count: 1, pilot: true, mini: groundMini('frame') }];
  const nav = [{ id: 'drop', name: 'Drop', at: drop }];
  for (const g of op.groups) {
    const M = D.groups.find((x) => x.id === g.id)?.members ?? [];
    if (!M.length) continue;
    const mid = [0, 1, 2].map((k) => M.reduce((a, m) => a + m[k], 0) / M.length), W = groupWords(g), p = at(mid);
    things.push({ id: g.id, name: W.name, side: 'foe', kind: 'group', label: W.label, at: p, heading: r1((Math.atan2(drop[0] - p[0], drop[1] - p[1]) * 180) / Math.PI), count: M.length, ...(g.reserve ? { arrives: true } : {}), mini: groundMini(g.kind) });
    nav.push({ id: g.id, name: W.name, at: p });
  }
  for (const b of D.beacons) {
    const p = at(b.at);
    things.push({ id: `beacon-${b.task}`, name: `Beacon ${b.task}`, side: 'beacon', kind: 'beacon', label: `task ${b.task}`, at: p, heading: 0, radius: b.radius });
    nav.push({ id: `beacon-${b.task}`, name: `Beacon ${b.task}`, at: p });
  }
  const ids = things.map((t) => t.id);
  // the steps: the operation's own design, else the field and then a step a task
  const B = raw.briefing ? readOperationBriefing(raw.briefing, ids, `levels.${id}.goal.operation.briefing`) : null;
  let beaconN = 0;
  const steps = (B ? B.steps : [
    { title: L.name ?? nameOfId(id), say: `The field, ${Math.round(D.field.half * 2)} m across. You drop at its south edge.`, show: [], routes: [] },
    ...op.tasks.map((t) => {
      const to = t.down ? t.down.filter((g) => ids.includes(g)) : t.reach ? [`beacon-${++beaconN}`] : [];
      return { title: taskText(t, op), say: t.down ? to.map((g) => things.find((x) => x.id === g).label).join(', ').replace(/^\w/, (c) => c.toUpperCase()) + '.' : t.reach ? 'Get your frame inside the beacon\'s ring.' : `Keep your frame alive for ${t.hold} seconds.`, show: to, routes: to.map((g) => ['drop', g]) };
    }),
  ]).map((s, k) => ({ id: `step-${k + 1}`, stage: 'theatre', part: 3, title: s.title, say: s.say, show: s.show, routes: s.routes }));
  const name = L.name ?? nameOfId(id), region = B?.region ?? 'Tharsis';
  return {
    // (`sounds`: the table's menus heard, the cursor's ticks played by the level's audio: gameworld/frame-sound.js)
    id, name, status: 'approved', rosterTitle: 'Forces', sounds: true,
    place: { line: ['Sol', 'Mars', region, name].join(' | '), parts: ['Sol', 'Mars', region, name] },
    // (the briefing opens on the field: the orrery is carried for the page's shape, never shown)
    orrery: (() => { const O = orrery(readPlace({ system: 'Sol', cluster: 'Mars', station: 'Operation', moon: 1 }), { moonKind: 'barren' }); return { ...O, homeMoons: O.planets[O.home].moons.length }; })(),
    theatre: { field: Math.round(bx1 - bx0), moon: { kind: 'barren', bearing: 35, elevation: 24, size: 'distant' }, rocks: [], nav,
      terrain: { x0: r1(bx0 - cx), y0: r1(by0 - cy), dx: r1(dx), nx: n, ny: n, z }, vertical: OPERATION_BRIEF.vertical, masses },
    things,
    steps,
    roster: things.filter((t) => t.kind === 'group').map((t) => ({ id: t.id, name: t.name, craft: t.label.replace(/^\d+ /, '').replace(/^\w/, (c) => c.toUpperCase()), count: t.count, side: t.side })),
    goals: op.tasks.map((t) => ({ text: taskText(t, op) })),
  };
}
