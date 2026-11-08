/**
 * A BLOCK'S BRIEF — what level design is handed for one block (the play layer's unit, `play:<level>/<segment>`): the
 * terrain as it was built (the block's square in world metres, its path, its ground and heights, what already stands
 * solid on it), the scenario's beats on it, the hero's kit, the roster it may cast from, the other departments'
 * suggestions with their authority, and the pieces it writes back. Everything handed: its one job is to make the
 * block's walk interesting and cohere.
 *
 *   playBrief({ segment, G, sketch, page, kit, roster, block? }) → { segment, box, path, solid, beats, kit, roster,
 *       suggestions, pieces, text }
 *     G         levelGrid's read; sketch readSketch's; page the block's built page (grid-scene: its faces, colliders)
 *     kit       the hero's: { run, sprint?, jump?, moves: [...], abilities?: [{ id, from }] } (what it can do and when)
 *     roster    { <bestiary id>: class } the level may stand
 *     block     the block's play layer as it stands (readPlay's), or none
 * Pure.
 */
import { levelHeight } from '../era/out-tile.js';
import { PIECE_KINDS, OBSTACLES, AUTHORITY } from './play-layer.js';
import { beatTile } from './map-sketch.js';

const r1 = (v) => Math.round(v * 10) / 10 + 0;

export function playBrief({ segment: S, G, sketch = null, page = null, kit = {}, roster = {}, block = null, seed = 1 }) {
  const P = G.plan, n = P.size, T = G.tile, [r0, c0] = P.segments[S].at, name = G.regions?.[S]?.name ?? P.segments[S]?.name ?? P.key?.[S]?.name ?? `block ${S}`;
  const L = { seed, ...(G.rise ? { rise: G.rise } : {}) }, z = (x, y) => r1(levelHeight(x, y, L));
  const box = [c0 * T, -(r0 + n) * T, (c0 + n) * T, -r0 * T].map((v) => v + 0);
  // (its path: each path tile's middle on the land, in reading order)
  const path = G.cells.filter((x) => x.kind === 'path' && x.r >= r0 && x.r < r0 + n && x.c >= c0 && x.c < c0 + n).map((x) => { const at = [(x.c + 0.5) * T, -(x.r + 0.5) * T]; return { tile: [x.r - r0, x.c - c0], at: [at[0], at[1], z(at[0], at[1])], open: x.open ?? [] }; });
  // (what already stands solid in it: the tiles' trunks, boulders, houses, walls, the size of each)
  const inBox = (c) => c.max[0] >= box[0] && c.min[0] <= box[2] && c.max[1] >= box[1] && c.min[1] <= box[3];
  const solid = (page?.colliders ?? []).filter(inBox).map((c) => ({ of: c.of ?? 'solid', at: [r1((c.min[0] + c.max[0]) / 2), r1((c.min[1] + c.max[1]) / 2)], size: [r1(c.max[0] - c.min[0]), r1(c.max[1] - c.min[1]), r1(c.max[2] - c.min[2])] }));
  const ground = sketch?.segments?.[S] ?? null;
  const beats = (sketch?.concept?.journey ?? []).filter((b) => b.at === S).map((b) => { const [tr, tc] = beatTile(G, sketch, b), at = [(tc + 0.5) * T, -(tr + 0.5) * T]; return { id: b.id, kind: b.kind, say: b.say, pace: b.pace ?? null, teach: b.teach ?? null, at: [r1(at[0]), r1(at[1]), z(at[0], at[1])], ...(b.opens ? { opens: true } : {}) }; });
  const foesOf = (sketch?.segments?.[S]?.marks ?? []).filter((m) => m.foes && m.beat).map((m) => ({ beat: m.beat, kind: m.foes.kind, count: m.foes.count }));
  const suggestions = block?.suggestions ?? [];
  const lines = [
    `# Level design brief: block ${S}, ${name}`,
    '',
    'Your one job: make this block\'s walk INTERESTING and cohere. The terrain, the cast and the scenario are handed to you',
    'and settled. Place pieces on the land: obstacles to route round and over, cover to fight from, the foes where a fight',
    'reads best (you cast: you may change the scenario\'s foes, unless a must says otherwise), pickups, gates, hazards and',
    'markers the walk steers by. Each piece serves a beat, or the walk between beats.',
    '',
    '## The block',
    `- Its square: x ${box[0]} to ${box[2]}, y ${box[1]} to ${box[3]} (world metres; z is up; north is +y).`,
    `- Its path tiles (${T} m each), their middles on the land: ${path.map((p) => `[${p.at.join(', ')}] open ${p.open.join('')}`).join('; ') || 'none'}.`,
    ...(ground ? [`- Its ground (rows north to south, a tile each): ${(ground.ground ?? []).join(' / ') || 'its region\'s own'}; heights in 3 m steps: ${(ground.height ?? []).join(' / ') || 'flat'}.`] : []),
    `- z: give the land's height where you know it (a path middle's, a beat's); any piece is SETTLED onto the land where it stands (its z made the land's), so a z near it is enough.`,
    `- Already solid (do not stand a piece inside these): ${solid.length ? solid.map((c) => `${c.of.replace(/^flora:/, '')} [${c.at.join(', ')}] ${c.size.join('×')}`).join('; ') : 'nothing'} (centre [x, y], size in m).`,
    '',
    '## The beats on this block (the scenario, settled)',
    ...(beats.length ? beats.map((b) => `- ${b.id} (${b.kind}${b.pace ? `, ${b.pace}` : ''}): ${b.say} — at [${b.at.join(', ')}]${b.teach ? `; teaches ${[].concat(b.teach).join(', ')}` : ''}${b.opens ? '; winning it opens the way on' : ''}`) : ['- none: the walk through']),
    ...(foesOf.length ? ['', `The scenario's foes here: ${foesOf.map((f) => `${f.count} ${f.kind} at ${f.beat}`).join('; ')}.`] : []),
    '',
    '## The hero',
    `- Runs ${kit.run ?? 6} m/s${kit.sprint ? `, sprints ${kit.sprint} m/s on stamina` : ''}${kit.jump ? `, jumps ${kit.jump} m high` : ''}.`,
    ...(kit.moves?.length ? [`- Moves: ${kit.moves.join(', ')}.`] : []),
    ...(kit.abilities?.length ? [`- Abilities and when they come: ${kit.abilities.map((a) => `${a.id} (${a.from})`).join(', ')}. A gate may ask for one the hero gets later: the block is come back to.`] : []),
    '',
    '## The roster you may cast from',
    `- ${Object.entries(roster).map(([k, c]) => `${k} (${c})`).join(', ') || 'none'}.`,
    '',
    '## Suggestions from the other departments',
    ...(suggestions.length ? suggestions.map((sg, i) => `- [${i}] ${sg.authority.toUpperCase()} from ${sg.from}: ${sg.say}${sg.about ? ` (about ${JSON.stringify(sg.about)})` : ''}`) : ['- none']),
    `- A must is not overridden. A should may be, with a reason: \`overrides: [{ suggestion: <its index>, why }]\`. A may is a hint.`,
    '',
    '## What you write back',
    `\`{ pieces: [{ id, kind, at: [x, y, z], yaw?, scale?, of?, beat?, why }], overrides? }\` for block ${S}.`,
    `- kind: ${PIECE_KINDS.join(', ')}. An obstacle or cover's \`of\` is a shape: ${Object.entries(OBSTACLES).map(([k, o]) => `${k} (${o.size.join('×')} m)`).join(', ')}.`,
    '- A foe\'s `of` a roster id (one piece a foe); a pickup\'s its item; a gate\'s what opens it; a hazard\'s and a marker\'s what it is.',
    '- `yaw` in degrees (0 faces +x, counter-clockwise); `why` the line it serves. Every piece inside the square, on the land, out of the solid things.',
    `- Authority words: ${AUTHORITY.join(', ')}.`,
  ];
  return { segment: S, box, path, solid, beats, kit, roster, suggestions, pieces: block?.pieces ?? [], text: lines.join('\n') };
}
