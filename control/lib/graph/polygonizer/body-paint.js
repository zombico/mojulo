/** body-paint.js — SECOND-SKIN garments as paint on the body's own faces: a leotard, tights, a tank, socks, gloves.
 * The swimsuit's rule (hero-dress.js SWIM_CUTS) as declared data: no geometry of its own, so it fits every body by
 * construction and bends with the skin, under every pose and dial, because it IS the skin's faces.
 *
 * A plan's `paint` is a list of entries, worn in order (a later entry paints over an earlier one; `Skin` cuts back):
 *   { part, u?: [a, b], run?: [a, b], t?: 'wrap' | [a, b], only?: [groups], group }
 * `part` names an L1 part: a base name (`thigh`) paints both sides and the part itself (`thighR`, `thighL`, `thigh`), a
 * name ending R or L that side alone. A list paints each. A band is painted when its middle lies in every window given:
 * `u` in the part's own station parameter (station-loft.js addressPin: the shaping rings' fractional u keep their
 * place), `run` as a share of the part's u span (0 its first station, 1 its last: one window reads alike on parts
 * whose stations differ by core), and `t` as a share of the ring half (0 front → 1 back, the swimsuit's measure, so an
 * entry reads the same in every register). Windows are half-open, [a, b), except a window reaching 1 holds 1; a window
 * too narrow to hold any band's middle (in u, run or t) paints the band holding its own middle.
 * `only` repaints a band only where it is one of those groups now (a garment clearing the swimsuit beneath it, `Swim`
 * → `Skin`, without touching an earlier garment's paint).
 * A cap (the part's `back` before its first ring, `tip` past its last) takes the group of its end band when that
 * band's whole ring is the one group and the entry covers the part end to end, so a sock closes over the toe and tights
 * close at the crotch, and a trim at an edge never floods the cap beyond it (a torso's top cap is the shoulders' yoke).
 *
 * Applied to the EXPANDED parts (station-loft-plan.js expandPlan), so a segment's generated rings are painted like a
 * loft's; a refine (station-loft-detail.js) splits a painted band into halves of the same group. A painted part names the
 * groups its paint laid (`painted`: the studio light shades them smoothly as cloth). Pure, deterministic;
 * absent, nothing changes. */

const both = (v) => (Array.isArray(v) ? v : [v]);
const isWin = (w) => Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] <= w[1];
const inWin = (x, w, top) => !w || (x >= w[0] && (x < w[1] || (w[1] >= top && x <= w[1])));

/** Error strings for a plan's `paint` (form only; part names are judged against the parts by `paintParts`). */
export function validatePaint(paint) {
  if (paint === undefined || paint === null) return [];
  if (!Array.isArray(paint)) return ['paint: a list of { part, u?, run?, t?, group }'];
  const errs = [];
  paint.forEach((P, i) => {
    const at = `paint[${i}]`;
    if (!P || typeof P !== 'object' || Array.isArray(P)) { errs.push(`${at}: { part, u?, run?, t?, group }`); return; }
    const parts = both(P.part);
    if (!parts.length || !parts.every((n) => typeof n === 'string' && n)) errs.push(`${at}.part: a part name or a list of them`);
    if (typeof P.group !== 'string' || !P.group) errs.push(`${at}.group: a palette group name`);
    if (P.u !== undefined && !isWin(P.u)) errs.push(`${at}.u: [a, b] in the part's station parameter, a ≤ b`);
    if (P.run !== undefined && !(isWin(P.run) && P.run[0] >= 0 && P.run[1] <= 1)) errs.push(`${at}.run: [a, b] shares of the part's span, 0 ≤ a ≤ b ≤ 1`);
    if (P.only !== undefined && !(Array.isArray(P.only) && P.only.length && P.only.every((g) => typeof g === 'string' && g))) errs.push(`${at}.only: a list of the groups it repaints`);
    if (P.t !== undefined && P.t !== 'wrap' && !(isWin(P.t) && P.t[0] >= 0 && P.t[1] <= 1)) errs.push(`${at}.t: 'wrap' or [a, b] shares of the ring half (0 front → 1 back)`);
    for (const k of Object.keys(P)) if (!['part', 'u', 'run', 't', 'only', 'group', 'id'].includes(k)) errs.push(`${at}.${k}: not a paint field (part, u, run, t, only, group, id)`);
  });
  return errs;
}

/** the parts an entry's name paints: a side name that part alone, a base name both sides and the part itself */
const partsNamed = (parts, name) => (/[RL]$/.test(name) && parts[name]?.layer === 1 ? [name]
  : Object.keys(parts).filter((n) => parts[n].layer === 1 && (n === name || n === `${name}R` || n === `${name}L`)));

/** Paint `paint` onto the L1 parts of an expanded recipe's `parts` (in place): each painted part takes fresh
 * `bandGroups` / `capGroups` (a mirrored limb shares its side's objects, so nothing is written through). Throws on a
 * name that paints no part. */
export function paintParts(parts, paint) {
  if (!paint?.length) return parts;
  paint.forEach((P, i) => {
    const names = both(P.part).flatMap((n) => { const hit = partsNamed(parts, n); if (!hit.length) throw new Error(`paint[${i}]: '${n}' is not an L1 part`); return hit; });
    for (const name of names) {
      const part = parts[name], n = part.slots.length, half = n / 2;
      const T = part.slots.slice(0, half + 1).map((sl, k) => part.slotT?.[sl] ?? k), H = T[half];
      const U = part.stations.map((st, k) => st.u ?? k), u0 = U[0], u1 = U[U.length - 1], span = u1 - u0 || 1;
      const bands = { ...(part.bandGroups || {}) }; let touched = false;
      // a window narrower than the part's rings holds no band's middle: it paints the band its own middle falls in (a
      // trim on a coarse ring is that ring's band, never nothing)
      const lo = Math.max(P.u?.[0] ?? u0, u0 + (P.run?.[0] ?? 0) * span), hi = Math.min(P.u?.[1] ?? u1, u0 + (P.run?.[1] ?? 1) * span), mid = (lo + hi) / 2;
      const hits = (s) => { const um = (U[s] + U[s + 1]) / 2; return inWin(um, P.u, u1) && inWin((um - u0) / span, P.run, 1); };
      const any = part.stations.slice(1).some((_, s) => hits(s));
      for (let s = 0; s + 1 < part.stations.length; s++) {
        const um = (U[s] + U[s + 1]) / 2;
        if (any ? !hits(s) : !(hi >= lo && mid >= U[s] && (mid < U[s + 1] || s + 2 === part.stations.length))) continue;
        const key = `${part.stations[s].id}-${part.stations[s + 1].id}`;
        const row = bands[key] ? [...bands[key]] : Array(half).fill(part.group ?? 'Body');
        let hit = false;
        // around the ring the same: a `t` window holding no band's middle paints the band holding its own middle
        const tIn = (k) => P.t === undefined || P.t === 'wrap' || inWin((T[k] + T[k + 1]) / (2 * H), P.t, 1);
        const tm = Array.isArray(P.t) ? (P.t[0] + P.t[1]) / 2 : null, tAny = Array.from({ length: half }, (_, k) => k).some(tIn);
        const tOk = (k) => (tAny ? tIn(k) : tm >= T[k] / H && (tm < T[k + 1] / H || k + 1 === half));
        for (let k = 0; k < half; k++) if ((!P.only || P.only.includes(row[k])) && tOk(k)) { row[k] = P.group; hit = true; }
        if (hit) { bands[key] = row; touched = true; }
      }
      if (!touched) continue;
      const whole = lo <= u0 + 1e-9 && hi >= u1 - 1e-9;   // the entry covers the part end to end: only then its caps too
      part.bandGroups = bands; if (P.group !== 'Skin' && P.group !== (part.group ?? 'Body')) part.painted = [...new Set([...(part.painted || []), P.group])];   // the cloth it laid (shaded smoothly)
      const ends = { back: `${part.stations[0].id}-${part.stations[1].id}`, tip: `${part.stations[U.length - 2].id}-${part.stations[U.length - 1].id}` };
      const caps = { ...(part.capGroups || {}) };
      if (whole) for (const [c, key] of Object.entries(ends)) { const row = bands[key]; if (row && row.every((g) => g === row[0]) && row[0] !== (part.group ?? 'Body')) caps[c] = row[0]; else if (row && row.every((g) => g === (part.group ?? 'Body')) && caps[c]) caps[c] = row[0]; }
      if (Object.keys(caps).length) part.capGroups = caps;
    }
  });
  return parts;
}
