/**
 * STANDS — a stage set's audience: tiers along the wall across from its open side, a barrier in front of them, and
 * people on them facing the open side. The stage kind's `stands` key (opt-in: absent, nothing is built).
 *
 *   stands: { room?, from?: m, rows?: 1-8, fill?: 0-1, shade?: 0.3-1, seed? }
 *     room  the room the stands are in (default the first); it must have exactly one open side
 *     from  how far from the open side the barrier stands (m, default 9): the floor in front is the set's to use
 *     rows  tiers, each a row of people a rise above the one in front (default 3; as many as fit the depth)
 *     fill  the share of seats taken (default 0.85)
 *     shade how bright the crowd stands (default 1; lower sets it back behind what plays in front of it)
 *
 * Built for the camera at the open side, so only what it sees is made: nothing in front of the barrier, nothing past
 * the back wall, and each person is the fractal city's pedestrian (figures/pedestrian-asset.js) at its `mini` detail,
 * a few hundred faces, baked once per pose, build and dress and stamped where they stand (the World page's instanced
 * `repeats`), with a slight tint so no two read the same. Poses mix standing and cheering. Pure and seeded.
 */
import { pedestrianFaces, PALETTES } from '../figures/pedestrian-asset.js';

const TIER = { d: 0.95, h: 0.42 };
const SEAT = 0.62, PERSON_M = 1.72, FIG_H = 0.72;   // a seat's width; a person's height; the asset's adult at scale 1
// most stand and watch; some cheer
const POSES = ['idleL', 'idleR', 'idleL', 'idleR', 'idleL', 'idleR', 'cheerL', 'cheerR'];
const BUILDS = ['adultM', 'adultF'];
const DRESSES = [PALETTES[0], PALETTES[1]];
const r3 = (v) => Math.round(v * 1000) / 1000;

function standsDice(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scaleHex = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('')}`;
};

/** A box in the stands' frame (u along the wall, v back from the open side, z up), its five seen faces. */
function standBox(toWorld, u0, v0, z0, u1, v1, z1, fill) {
  const c = [[u0, v0, z0], [u1, v0, z0], [u1, v1, z0], [u0, v1, z0], [u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]].map(toWorld);
  const q = (a, b, d, e, k) => ({ corners: [c[a], c[b], c[d], c[e]], fill: scaleHex(fill, k) });
  return [q(4, 5, 6, 7, 1), q(0, 1, 5, 4, 0.8), q(0, 4, 7, 3, 0.68), q(1, 2, 6, 5, 0.68)];
}

/** Check a stage's `stands` against its room; → the room and the read settings. */
export function readStands(stands, rooms) {
  if (!stands || typeof stands !== 'object' || Array.isArray(stands)) throw new Error('stage: stands is { room?, from?, rows?, fill?, seed? }');
  const room = stands.room === undefined ? rooms[0] : rooms.find((r) => r.id === stands.room);
  if (!room) throw new Error(`stage: stands.room '${stands.room}' is not one of the rooms`);
  const open = Array.isArray(room.open) ? room.open : [];
  if (open.length !== 1) throw new Error(`stage: stands face a room's one open side (room '${room.id}' has ${open.length})`);
  const rows = stands.rows ?? 3, fill = stands.fill ?? 0.85, from = stands.from ?? 9;
  if (!(Number.isInteger(rows) && rows >= 1 && rows <= 8)) throw new Error('stage: stands.rows is 1 to 8');
  if (!(fill >= 0 && fill <= 1)) throw new Error('stage: stands.fill is 0 to 1');
  if (!(from >= 1)) throw new Error('stage: stands.from is at least 1 m from the open side');
  const shade = stands.shade ?? 1;
  if (!(shade >= 0.3 && shade <= 1)) throw new Error('stage: stands.shade is 0.3 to 1');
  return { room, side: open[0], rows, fill, from, shade, seed: Number.isInteger(stands.seed) ? stands.seed : 1 };
}

/**
 * The stands as instanced repeats, in the stage's metres. → { repeats, rows, people }.
 * `colors`: { tier, rail } for the concrete (defaults a cool grey).
 */
export function standsRepeats(stands, rooms, colors = {}) {
  const S = readStands(stands, rooms);
  const { room } = S;
  // the stands' frame: u runs along the far wall (left to right as the open side sees it), v back from the open side
  const W = room.w, D = room.d;
  const frame = {
    '-y': { len: W, depth: D, at: (u, v) => [room.x + W / 2 + u, room.y + v], yaw: 0 },
    '+y': { len: W, depth: D, at: (u, v) => [room.x + W / 2 - u, room.y + D - v], yaw: Math.PI },
    '-x': { len: D, depth: W, at: (u, v) => [room.x + v, room.y + D / 2 - u], yaw: -Math.PI / 2 },
    '+x': { len: D, depth: W, at: (u, v) => [room.x + W - v, room.y + D / 2 + u], yaw: Math.PI / 2 },
  }[S.side];
  const toWorld = ([u, v, z]) => { const [x, y] = frame.at(u, v); return [r3(x), r3(y), r3(z)]; };
  const inner = frame.len - 1.6, half = inner / 2;
  const fit = Math.max(0, Math.floor((frame.depth - S.from - 0.6) / TIER.d));
  const n = Math.min(S.rows, fit);
  const out = [];
  if (n > 0) {
    // the tiers are one box per row, stepping up; the barrier a low wall in front of the first
    const tierFill = colors.tier ?? '#6a6c74', railFill = colors.rail ?? '#383a42';
    const steps = [];
    for (let r = 0; r < n; r++) steps.push(...standBox(toWorld, -half, S.from + r * TIER.d, 0, half, S.from + (r + 1) * TIER.d, (r + 1) * TIER.h, tierFill));
    steps.push(...standBox(toWorld, -half, S.from - 0.3, 0, half, S.from - 0.18, 1.05, railFill));
    out.push({ template: steps, transforms: [{ pos: [0, 0, 0] }], group: 'stands' });
  }
  // the people: one template per pose, build and dress, facing the open side (the asset's front is +x)
  const dice = standsDice(S.seed * 7919 + 13);
  const templates = new Map();
  let people = 0;
  const heading = frame.yaw - Math.PI / 2;
  const scale = r3(PERSON_M / FIG_H);
  for (let r = 0; r < n; r++) {
    const count = Math.floor(inner / SEAT);
    for (let k = 0; k < count; k++) {
      if (dice() > S.fill) continue;
      const pose = POSES[Math.floor(dice() * POSES.length)];
      const build = BUILDS[dice() < 0.5 ? 0 : 1];
      const dress = Math.floor(dice() * DRESSES.length);
      const key = `${pose}|${build}|${dress}`;
      if (!templates.has(key)) templates.set(key, { template: pedestrianFaces({ lod: 'mini', pose, archetype: build, palette: DRESSES[dress], heading, scale }), transforms: [], group: 'stands-crowd' });
      const u = -half + SEAT * (k + 0.5) + (dice() - 0.5) * 0.18;
      const v = S.from + r * TIER.d + TIER.d * (0.45 + (dice() - 0.5) * 0.2);
      const tint = [0.78 + dice() * 0.3, 0.78 + dice() * 0.3, 0.78 + dice() * 0.3].map((v) => r3(v * S.shade));
      templates.get(key).transforms.push({ pos: toWorld([u, v, (r + 1) * TIER.h]), rotZ: r3((dice() - 0.5) * 0.5), tint });
      people++;
    }
  }
  for (const k of [...templates.keys()].sort()) out.push(templates.get(k));
  return { repeats: out, rows: n, people };
}
