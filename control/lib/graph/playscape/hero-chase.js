/**
 * hero-chase — a person's follow camera: the chase a hero on foot is played through (playscape/player.js) and what a
 * city level's stalker takes (city/plan/level.js). (A mascot's, egocube/mascot-pilot.js, keeps its own: tuned with the
 * stand-off its smaller height shrinks.)
 *
 * Laid long by the follow camera's stand-off (scene/channels/controllable/follow-pull-in.js): with nothing behind it the
 * page stands the eye 3 m short of the line the follow rule lays, so the line is laid 3 m longer than the framing. Here
 * the framing is the one the chase was always meant to have, the eye 5.5 m behind the hero and 2.4 m up, looking at
 * its chest 1.5 m ahead: a person about a fifth of the frame across, outdoors. (2026-11-02: laid at those numbers, the
 * stand-off put the eye 1.15 m behind the hero, 45–47 % of the frame across.)
 */
const FRAME = { behind: 5.5, eyeH: 2.4, lookH: 1.1, lead: 1.5 };
const STAND_OFF = 3;   // follow-pull-in.js: the stand-off for anything a person's height or taller
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A chase framed as `F` says (the eye `behind` the subject and `eyeH` up, looking at `lookH` `lead` ahead): the follow
 * rule's settings, the line through that eye lengthened by the stand-off, the eye sitting STAND_OFF short of its end.
 * → { dist, height, lookH, lead } */
export function chaseFor(F) {
  const dx = F.behind + F.lead, dz = F.eyeH - F.lookH, e = Math.hypot(dx, dz), k = (e + STAND_OFF) / e;
  return Object.freeze({ dist: r3(dx * k - F.lead), height: r3(F.lookH + dz * k), lookH: F.lookH, lead: F.lead });
}

/** The follow rule's settings for a person's chase: { dist, height, lookH, lead }. */
export const HERO_CHASE = chaseFor(FRAME);

/** A PARTY RPG's chase (figure-grades.js: its people at the play grade): pulled back and up, the hero about a tenth of
 * the frame across instead of a fifth, the road ahead and the town round it read; the eye about twice as far, looking
 * down a little more, at the same chest. */
export const PARTY_FRAME = Object.freeze({ behind: 9.5, eyeH: 5.4, lookH: 1.1, lead: 2 });
export const PARTY_CHASE = chaseFor(PARTY_FRAME);
