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

// the line through the eye's framing, lengthened by the stand-off: the eye sits on it STAND_OFF short of its end
const dx = FRAME.behind + FRAME.lead, dz = FRAME.eyeH - FRAME.lookH, e = Math.hypot(dx, dz), k = (e + STAND_OFF) / e;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The follow rule's settings for a person's chase: { dist, height, lookH, lead }. */
export const HERO_CHASE = Object.freeze({ dist: r3(dx * k - FRAME.lead), height: r3(FRAME.lookH + dz * k), lookH: FRAME.lookH, lead: FRAME.lead });
