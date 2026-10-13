/**
 * ROUTINES — the cast keeping their own day (cosmos mind.social=schedule). A routine is where someone goes, hour by hour,
 * on the level's clock (the clock mechanic's `hour` on the bus): at each hour of their plan they walk to its place and
 * stay (in its pose). As the level starts they walk to where the hour finds them (the plan's last entry before it).
 *
 *   play.routines: [{ who, plan: [{ hour: 0 to 23, to: '<place>', pose? }, …] }]   (hours ascending, two at least)
 *
 *   readRoutines(play)     → [{ who, plan }] or throws, teaching
 *   routineCues(play)      → the cues: one an hour of the plan (var hour eq), and the start's (the hour's window)
 *   withRoutineCues(play)  → play with those cues appended (the same object without routines)
 */
const ID = /^[a-z][a-z0-9_-]*$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`play.routines${m}`);

export function readRoutines(play) {
  const R = play && play.routines;
  if (R === undefined) return [];
  if (!Array.isArray(R)) throw err(' is a list of { who, plan: [{ hour, to, pose? }] }: where each goes, hour by hour');
  const seen = new Set();
  return R.map((r, i) => {
    const at = `[${i}]`;
    if (!isObj(r) || typeof r.who !== 'string' || !ID.test(r.who)) throw err(`${at} is { who, plan }: who is a character's id`);
    if (seen.has(r.who)) throw err(`${at}.who '${r.who}' has two routines`);
    seen.add(r.who);
    if (!Array.isArray(r.plan) || r.plan.length < 2) throw err(`${at}.plan is two or more { hour, to, pose? }`);
    const plan = r.plan.map((s, k) => {
      if (!isObj(s) || !Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) throw err(`${at}.plan[${k}].hour is a whole hour, 0 to 23`);
      if (typeof s.to !== 'string' || !s.to) throw err(`${at}.plan[${k}].to is a place (a spot or an anchor)`);
      if (k && s.hour <= r.plan[k - 1].hour) throw err(`${at}.plan hours go up through the day`);
      return { hour: s.hour, to: s.to, ...(typeof s.pose === 'string' ? { pose: s.pose } : {}) };
    });
    return { who: r.who, plan };
  });
}

export function routineCues(play) {
  const cues = [];
  for (const { who, plan } of readRoutines(play)) {
    const go = (s) => ({ walk: { who, to: s.to, then: 'stay', ...(s.pose ? { pose: s.pose } : {}) } });
    plan.forEach((s, k) => {
      cues.push({ id: `routine-${who}-${s.hour}`, when: { var: 'hour', eq: s.hour }, then: go(s) });
      // the start: where the hour finds them (from this entry's hour to the next's; the last runs past midnight to the first)
      const next = plan[(k + 1) % plan.length].hour;
      const guard = k < plan.length - 1 ? [{ var: 'hour', gte: s.hour }, { var: 'hour', lt: next }] : null;
      if (guard) cues.push({ id: `routine-${who}-from-${s.hour}`, when: { start: true }, if: guard, then: go(s) });
      else {
        cues.push({ id: `routine-${who}-from-${s.hour}`, when: { start: true }, if: { var: 'hour', gte: s.hour }, then: go(s) });
        if (plan[0].hour > 0) cues.push({ id: `routine-${who}-from-0`, when: { start: true }, if: { var: 'hour', lt: plan[0].hour }, then: go(s) });
      }
    });
  }
  return cues;
}

export function withRoutineCues(play) {
  if (!play || play.routines === undefined) return play;
  return { ...play, cues: [...(play.cues || []), ...routineCues(play)] };
}
