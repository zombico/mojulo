/**
 * A BUILDING'S EXHIBITS: things minted elsewhere in mojulo (a solid, a character, a vehicle, any stored sketch that draws
 * faces) stood in its rooms, each on a plinth, the way a museum hangs a collection by wing. A museum's program
 * (programs.js `museum`) lays its wings in a T off its lobby, every room along them a gallery and each wing's end its
 * hall; its `exhibits` names a collection a wing, in the order the wings leave the core (a: +x, b: −x, c: +y).
 *
 *   exhibits: [{ title?, pieces: ['<ref>' | { ref, name?, life? }] }]        one collection a wing, at most one a wing
 *     a piece          a stored sketch's ref: fitted, scaled to stand within its plinth's top (a model of it, a car at
 *                      the size of a toy), on a plinth down the middle of a gallery
 *     life: true       stood whole on a low dais in its wing's end hall (one a wing), as large as the hall allows
 *
 *   layExhibits(plan, exhibits) → { props, items, wings, findings }
 *     props            the plinths and daises, stage props (compose-dress.js PIECES `plinth`, `dais`)
 *     items            each piece as an itemRef (worlds/world-scene.js resolves the ref and fits its faces): { ref, name,
 *                      center, z, size, height, facing }
 *     wings            [{ letter, title, rooms, pieces }] what each wing holds, for its book
 *     findings         what did not fit (a wing with more pieces than its rooms hold; a second life piece)
 *
 * Pure: the stage's planned rooms and links in, the props and items out. A building with no `exhibits` lays none.
 */
import { PIECES } from './compose-dress.js';

/** How a room holds its pieces: up to `most` plinths in a grid, kept `edge` metres off its walls and `gap` apart. */
export const EXHIBIT = Object.freeze({ most: 4, edge: 1.6, gap: 3.2, top: 1.2, tall: 1.9, life: Object.freeze({ size: [4.4, 2.4], tall: 3.2 }) });
export const EXHIBIT_LIMITS = Object.freeze({ wings: 3, pieces: 24 });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (says) => { throw new Error(`exhibits: ${says}`); };
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A building's `exhibits`, checked: a list of collections, one a wing. */
export function readExhibits(E) {
  if (E === undefined) return undefined;
  if (!Array.isArray(E) || !E.length) fail("is a list of collections, one a wing: [{ title?, pieces: ['<ref>' | { ref, name?, life? }] }]");
  if (E.length > EXHIBIT_LIMITS.wings) fail(`has ${E.length} collections; a museum has ${EXHIBIT_LIMITS.wings} wings`);
  return E.map((c, i) => {
    if (!isObj(c)) fail(`[${i}] is { title?, pieces: [...] }`);
    const bad = Object.keys(c).filter((k) => !['title', 'pieces'].includes(k));
    if (bad.length) fail(`[${i}].${bad[0]} is not a collection's key (title, pieces)`);
    if (c.title !== undefined && !(typeof c.title === 'string' && c.title.trim())) fail(`[${i}].title is a name`);
    const P = c.pieces ?? [];
    if (!Array.isArray(P)) fail(`[${i}].pieces is a list of refs`);
    if (P.length > EXHIBIT_LIMITS.pieces) fail(`[${i}] has ${P.length} pieces; a wing holds at most ${EXHIBIT_LIMITS.pieces}`);
    const pieces = P.map((p, k) => {
      const q = typeof p === 'string' ? { ref: p } : p;
      if (!isObj(q) || typeof q.ref !== 'string' || !q.ref) fail(`[${i}].pieces[${k}] is a stored sketch's ref, or { ref, name?, life? }`);
      const no = Object.keys(q).filter((key) => !['ref', 'name', 'life'].includes(key));
      if (no.length) fail(`[${i}].pieces[${k}].${no[0]} is not a piece's key (ref, name, life)`);
      if (q.life !== undefined && typeof q.life !== 'boolean') fail(`[${i}].pieces[${k}].life is true or false`);
      return { ref: q.ref, ...(typeof q.name === 'string' && q.name.trim() ? { name: q.name.trim() } : {}), ...(q.life ? { life: true } : {}) };
    });
    return { ...(c.title ? { title: c.title.trim() } : {}), pieces };
  });
}

// the spots a room's plinths stand on: a centred grid of n (1, 2 or up to 4), `gap` apart, held off the walls
function spots(r, n) {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, w = r.x1 - r.x0, d = r.y1 - r.y0, g = EXHIBIT.gap;
  const fit = (k, span) => Math.max(1, Math.min(k, Math.floor((span - 2 * EXHIBIT.edge) / g) + 1));
  const cols = n === 1 ? 1 : fit(2, w), rows = n <= cols ? 1 : fit(Math.ceil(n / cols), d);
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (out.length < n) out.push([r3(cx + (i - (cols - 1) / 2) * g), r3(cy + (j - (rows - 1) / 2) * g)]);
  return out;
}

/** The rooms of each wing, near to far: a room joined to a wing's corridor is that wing's (its letter the corridor's). */
function wingRooms(plan) {
  const wings = new Map();
  const corridor = (id) => /^corridor-\d+([a-z])$/.exec(id)?.[1] ?? null;
  for (const l of plan.links ?? []) {
    const [c, room] = corridor(l.from) ? [corridor(l.from), l.to] : corridor(l.to) ? [corridor(l.to), l.from] : [null, null];
    // (the core, the lobby and a stair are the building's ways, not a wing's rooms)
    if (!c || corridor(room) || /^(core|lobby|stair)/.test(room)) continue;
    if (!wings.has(c)) wings.set(c, []);
    if (!wings.get(c).includes(room)) wings.get(c).push(room);
  }
  return [...wings.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([letter, rooms]) => ({ letter, rooms }));
}

/** The plinths and the pieces on them (see the header). `plan`: planStage's (rooms with x0..y1, links). */
export function layExhibits(plan, exhibits) {
  const E = readExhibits(exhibits) ?? [], findings = [], props = [], items = [], wings = [];
  const byId = new Map((plan.rooms ?? []).map((r) => [r.id, r]));
  const W = wingRooms(plan);
  E.forEach((C, i) => {
    const wing = W[i];
    if (!wing) { findings.push({ id: 'no-wing', says: `collection ${i + 1}${C.title ? ` (${C.title})` : ''} has no wing to stand in: the building has ${W.length}` }); return; }
    const rooms = wing.rooms.map((id) => byId.get(id)).filter(Boolean);
    const isHall = (r) => /^(hall|great-hall)\b/.test(r.id) || r.id === 'great-hall';
    const hall = rooms.find(isHall) ?? null, galleries = rooms.filter((r) => r !== hall);
    const life = C.pieces.filter((p) => p.life), small = C.pieces.filter((p) => !p.life);
    // (one life-size piece on the hall's dais; a second, and a wing with no hall, stands as a model with the rest)
    if (life.length > 1 || (life.length && !hall)) findings.push({ id: 'life', says: `wing ${wing.letter}: ${hall ? 'one piece stands life-size in its hall' : 'no hall to stand a piece life-size in'}; ${hall ? life.length - 1 : life.length} stand as models` });
    const star = hall && life.length ? life[0] : null, models = [...(star ? life.slice(1) : life), ...small];
    // (the models through its galleries near to far, as evenly as they go; its hall too when no piece stands life-size)
    const shelf = star ? galleries : [...galleries, ...(hall ? [hall] : [])];
    const per = shelf.length ? Math.min(EXHIBIT.most, Math.ceil(models.length / shelf.length)) : 0;
    if (models.length > per * shelf.length) findings.push({ id: 'full', says: `wing ${wing.letter}: ${models.length} pieces, room for ${per * shelf.length}` });
    let k = 0;
    const held = [];
    for (const r of shelf) {
      const here = models.slice(k, k + per);
      k += here.length;
      spots(r, here.length).forEach((at, n) => {
        const p = here[n], id = `${r.id}/exhibit/${n + 1}`, P = PIECES.plinth;
        props.push({ id, kind: 'plinth', room: r.id, at, facing: '+y' });
        items.push({ ref: p.ref, name: p.name ?? `${wing.letter}-${held.length + 1}`, center: at, z: r3((r.z0 ?? 0) + P.h), size: [EXHIBIT.top, EXHIBIT.top], height: EXHIBIT.tall, facing: '+y' });
        held.push({ ref: p.ref, room: r.id, at });
      });
    }
    if (star) {
      const at = [r3((hall.x0 + hall.x1) / 2), r3((hall.y0 + hall.y1) / 2)], fits = [Math.min(EXHIBIT.life.size[0], hall.x1 - hall.x0 - 2), Math.min(EXHIBIT.life.size[1], hall.y1 - hall.y0 - 2)];
      props.push({ id: `${hall.id}/exhibit/dais`, kind: 'dais', room: hall.id, at, facing: '+y' });
      items.push({ ref: star.ref, name: star.name ?? `${wing.letter}-hall`, center: at, z: r3((hall.z0 ?? 0) + PIECES.dais.h), size: fits.map(r3), height: Math.min(EXHIBIT.life.tall, (hall.h ?? 4) - 1), facing: '+y' });
      held.push({ ref: star.ref, room: hall.id, at, life: true });
    }
    wings.push({ letter: wing.letter, ...(C.title ? { title: C.title } : {}), rooms: rooms.map((r) => r.id), pieces: held });
  });
  return { props, items, wings, findings };
}
