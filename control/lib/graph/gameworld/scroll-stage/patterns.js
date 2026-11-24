/**
 * THE FOES' FIRE AND THE FOES (Blaze Gunner): what the ship dodges. A bullet pattern is a VOLLEY in time, laid in the
 * scroll stage's screen axes from the foe that fires it; a foe is a body, a way to fly and a pattern. Both are rows. The
 * principle the side map holds for every round (docs/side-map-principles.md "A shot is seen coming") is this game's
 * whole contract: a bullet crosses the screen at a pace a player reads, there is always a way through a volley, and
 * every volley is told before it is fired.
 *
 * Sizes are in SHIP LENGTHS (L) and speeds in SCREENS ACROSS a second (S/s), lowered to metres by the stage.
 *
 *   a PATTERN    { tell s (the foe's glow before it fires), every s (between volleys), volleys? (a burst; 1), shots n,
 *                spread° (a fan's whole width; 360 a ring), aim: 'ship' | 'ahead' (toward the ship, or back down the
 *                scroll at it), turn° (each volley turned this much more: a spiral), speed S/s, r L, dmg, gap? L (a WALL:
 *                a line of shots across the screen with one gap, laid where the ship is not) }
 *   a FOE        { hp, craft (its body off the craft shelf: its measures its hit radius), pattern?, path, speed S/s
 *                (how fast it flies its path), score }
 *   a PATH       line (straight back across the screen) | sine { amp S, period s } | dive (to the ship's height, then on)
 *                | hold { at: share of the screen from its right edge, for: s } (comes in, holds station, fires, leaves)
 *                | fixed (where it stands in the world: a hull's gun)
 *
 *   PATTERNS, PATTERN_IDS, FOES, FOE_IDS, HITBOX (the ship's, a share of its length), SEEN (the fastest a bullet is),
 *   SAFE (no volley fired from nearer the ship than this, in ship lengths), DODGE (the margin a gap leaves round the hitbox)
 *   patternLaws(rows?)        → [{ id, holds, says }]: seen coming; a way through; told
 *   FOE_HUE                  the foes' bullets' one colour, never a pod's: a hot magenta read against any ground
 *   lowerFoes(ids, { L, S }) → the runtime's foes and their patterns, in metres (a foe's hit radius is its body's: the
 *                              stage measures its craft)
 *
 * Pure: data and numbers.
 */
const row = (o) => Object.freeze(o);
/** The ship's hitbox: a core round its canopy, its radius a fourteenth of the ship's length (the genre's: far smaller than
 * the ship drawn). */
export const HITBOX = 0.07;
/** The fastest a foe's bullet flies: it takes at least two seconds to cross the screen across. */
export const SEEN = 0.5;
/** No volley is fired from nearer the ship than this (ship lengths): nothing is born on top of it. */
export const SAFE = 2.5;
/** The margin a gap leaves round the hitbox, each side (ship lengths). */
export const DODGE = 0.12;
/** How far from the foe a fan's or a ring's neighbours are measured (ship lengths): where a player meets them. */
const MEET = 3;
/** The foes' bullets' one colour: a hot magenta, no pod's hue (pods.js), read against space and a hull alike. */
export const FOE_HUE = '#ff3fa4';

export const PATTERNS = Object.freeze({
  // one aimed bullet: the first thing a player learns to step off
  aimed: row({ tell: 0.4, every: 1.6, shots: 1, spread: 0, aim: 'ship', speed: 0.38, r: 0.09, dmg: 1 }),
  // three aimed in quick succession: step off, then keep moving
  burst: row({ tell: 0.4, every: 2.2, volleys: 3, gap_s: 0.14, shots: 1, spread: 0, aim: 'ship', speed: 0.42, r: 0.08, dmg: 1 }),
  // a fan of five at the ship: slip between them or round them
  fan: row({ tell: 0.5, every: 2.4, shots: 5, spread: 60, aim: 'ship', speed: 0.32, r: 0.1, dmg: 1 }),
  // a ring out all round: the heavy's, read from a distance
  ring: row({ tell: 0.6, every: 2.8, shots: 12, spread: 360, aim: 'ahead', speed: 0.26, r: 0.11, dmg: 1 }),
  // a ring turned a little each volley: the screen swept by arms
  spiral: row({ tell: 0.5, every: 0.35, shots: 4, spread: 360, aim: 'ahead', turn: 17, speed: 0.24, r: 0.09, dmg: 1 }),
  // a line across the screen with one gap where the ship is not: find it
  wall: row({ tell: 0.8, every: 3.2, shots: 0, spread: 0, aim: 'ahead', speed: 0.2, r: 0.12, dmg: 1, gap: 1.1 }),
});
export const PATTERN_IDS = Object.freeze(Object.keys(PATTERNS));

export const FOES = Object.freeze({
  // a small drone in a wave: one tap, a weave, now and then an aimed shot
  drone: row({ hp: 1, craft: 'daggerInterceptor', pattern: 'aimed', path: row({ kind: 'sine', amp: 0.12, period: 2.4 }), speed: 0.22, score: 100 }),
  // a dart that dives at the ship's height and runs on
  dart: row({ hp: 2, craft: 'twinPanel', path: row({ kind: 'dive' }), speed: 0.34, score: 150 }),
  // a gun pod that comes in, holds station, fans at the ship and leaves
  gunpod: row({ hp: 8, craft: 'triPanelDefender', pattern: 'fan', path: row({ kind: 'hold', at: 0.28, for: 6 }), speed: 0.2, score: 400 }),
  // a heavy: slow, armoured, rings and spirals
  heavy: row({ hp: 24, craft: 'twinPodBomber', pattern: 'spiral', path: row({ kind: 'hold', at: 0.35, for: 9 }), speed: 0.12, score: 1200 }),
  // a carrier: it brings a pod and runs, firing nothing: catch it before it leaves
  carrier: row({ hp: 5, craft: 'utilityShuttle', path: row({ kind: 'line' }), speed: 0.15, score: 300 }),
  // a wall layer: holds back and lays a wall with a gap
  layer: row({ hp: 10, craft: 'facetRaider', pattern: 'wall', path: row({ kind: 'hold', at: 0.12, for: 8 }), speed: 0.16, score: 600 }),
  // a hull's gun on its hardpoint (a capital ship on the play plane): fixed where it stands, aimed at the ship while it is
  // on the screen, down with its mount's block (rupa's `onBlock`); never in a wave, it comes with its hull
  turret: row({ hp: 4, pattern: 'aimed', path: row({ kind: 'fixed' }), speed: 0, score: 250 }),
});
export const FOE_IDS = Object.freeze(Object.keys(FOES));

const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The laws a pattern is held to: they advise, none refuses. */
export function patternLaws(rows = PATTERNS) {
  const out = [], ids = Object.keys(rows), hit = 2 * HITBOX;   // the hitbox's width, L
  const fast = ids.filter((id) => rows[id].speed > SEEN);
  out.push({ id: 'seen-coming', holds: !fast.length, says: fast.length ? `a bullet too fast to read: ${fast.join(', ')}` : `every bullet takes at least ${r3(1 / SEEN)} s to cross the screen` });
  // a way through: neighbours in a fan or a ring, where the ship meets them, are further apart than two bullets and the
  // hitbox with its margin; a wall's gap wider than the hitbox and its margins
  const shut = ids.filter((id) => {
    const P = rows[id];
    if (P.gap !== undefined) return !(P.gap > hit + 2 * DODGE + 2 * P.r);
    if (P.shots < 2) return false;
    const step = (P.spread >= 360 ? 360 / P.shots : P.spread / (P.shots - 1)) * DEG, apart = 2 * MEET * Math.sin(step / 2);
    return !(apart - 2 * P.r > hit + 2 * DODGE);
  });
  out.push({ id: 'a-way-through', holds: !shut.length, says: shut.length ? `a volley with no way through: ${shut.join(', ')}` : 'every volley leaves a way through wider than the hitbox and its margins' });
  const untold = ids.filter((id) => !(rows[id].tell >= 0.3));
  out.push({ id: 'told', holds: !untold.length, says: untold.length ? `a volley fired untold: ${untold.join(', ')}` : 'every volley is told at least 0.3 s before it is fired' });
  return out;
}

/** The runtime's foes and the patterns they fire, in metres: a ship `L` metres long, a screen `S` metres across. */
export function lowerFoes(ids = FOE_IDS, { L, S }) {
  const len = (v) => r3(v * L), spd = (v) => r3(v * S), patterns = {}, foes = {};
  for (const id of ids) {
    const F = FOES[id];
    if (!F) throw new Error(`scroll stage: '${id}' is not a foe (${FOE_IDS.join(', ')})`);
    const p = F.path;
    foes[id] = { hp: F.hp, craft: F.craft, speed: spd(F.speed), score: F.score, ...(F.pattern ? { pattern: F.pattern } : {}),
      path: p.kind === 'sine' ? { kind: 'sine', amp: spd(p.amp), period: p.period } : p.kind === 'hold' ? { kind: 'hold', at: p.at, for: p.for } : { kind: p.kind } };
    if (F.pattern && !patterns[F.pattern]) {
      const P = PATTERNS[F.pattern];
      patterns[F.pattern] = { tell: P.tell, every: P.every, volleys: P.volleys || 1, gapS: P.gap_s || 0, shots: P.shots, spread: P.spread, aim: P.aim, turn: P.turn || 0,
        speed: spd(P.speed), r: len(P.r), dmg: P.dmg, ...(P.gap !== undefined ? { gap: len(P.gap) } : {}) };
    }
  }
  return { foes, patterns, hitbox: len(HITBOX), safe: len(SAFE), hue: FOE_HUE };
}

