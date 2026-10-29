/**
 * A BEAST-KIN'S DETAIL AS FORM: the silhouette's breakers, real parts on the tiered body where the creature biped drew
 * them as cards (the sixth generation's spines and tufts read as a crest at any distance, and its cover as a material
 * cannot break an outline: ./cover.js is the fine grain, these the shapes). Each is a word on the hero's `beast`, its
 * default the kin's card's:
 *
 *   ridge   'none' | 'spines': a crest of flat spines down the back, from the neck's root to the hips and on down the
 *           tail, tallest over the shoulders, each raked toward the tail and riding the bone it stands on (the neck, the
 *           torso, the lumbar, the pelvis, the tail's own)
 *   ruff    'none' | 'ruff': two staggered rows of heavy tufts round the back and the sides of the neck's root, hanging
 *           out and down (a wolf's, a bear's long shoulder fur), riding the torso
 *
 *   beastDetail(plan, hero)  → after the tiered passes and the sockets: the plan with its spines and its tufts
 *
 * The insect's abdomen is a shape of the tail's (./topology.js `abdomen`). Absent each word, nothing of it. Pure.
 */
import { beastCard } from './tiered.js';
import { scaleOf } from './topology.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const unit = (v) => mul(v, 1 / (Math.hypot(...v) || 1));
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

export const BEAST_RIDGES = Object.freeze(['none', 'spines']);
export const BEAST_RUFFS = Object.freeze(['none', 'ruff']);

/** the ridge (metres at the biped's 2 m): each spine's height down the back from the neck's root to the hips, and down
 * the tail station by station; its thickness at the root (a small one's a third of its width, so it stays a blade); how far it is sunk into the surface, of its height; its rake
 * toward the tail, against its way out */
const RIDGE = Object.freeze({ neck: [0.055, 0.07], back: [0.1, 0.11, 0.1, 0.085, 0.07, 0.055], tail: [0.07, 0.06, 0.048, 0.036], thick: 0.014, sunk: 0.4, rake: 0.6 });
/** the ruff: its two rows (the first at the neck's root, the second below it, each a fan of tufts from `from` to `to`
 * degrees round from the front, `n` of them on a side), a tuft's length and its root's half width and depth (metres at
 * 2 m), its hang (down, against out), and how far it is sunk, of its length */
const RUFF = Object.freeze({ rows: Object.freeze([{ dz: 0.01, from: 80, to: 180, n: 6, len: 0.15 }, { dz: -0.06, from: 92, to: 180, n: 6, len: 0.18 }]), root: [0.05, 0.036], hang: 1.1, sunk: 0.3 });

export function detailOf(hero) {
  const card = beastCard(hero); if (!card) return null;
  // (an ooze's crest in its own group and at its own height: ./ooze.js, ./style.js)
  return { ridge: card.ridge, ruff: card.ruff, spines: card.ooze?.spines ?? null };
}

// a trunk's back-centre and its section at height z (the stations blended), among the trunk's segments
function sectionAt(segments, z) {
  const trunks = segments.filter((s) => s.kind === 'trunk' && (s.name === 'torso' || s.name === 'pelvis'));
  const S = trunks.find((s) => z >= s.stations[0].z && z <= s.stations.at(-1).z) ?? trunks.find((s) => s.name === 'torso');
  const st = S.stations, i = Math.max(0, Math.min(st.length - 2, st.findIndex((x, j) => j < st.length - 1 && z <= st[j + 1].z)));
  const a = st[i], b = st[i + 1], t = b.z === a.z ? 0 : Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), r = (x) => (Array.isArray(x.r) ? x.r : [x.r, x.r]);
  return { yc: (a.yc ?? 0) + ((b.yc ?? 0) - (a.yc ?? 0)) * t, rx: r(a)[0] + (r(b)[0] - r(a)[0]) * t, ry: r(a)[1] + (r(b)[1] - r(a)[1]) * t };
}

export function beastDetail(plan, hero) {
  const D = detailOf(hero);
  if (!D || (D.ridge === 'none' && D.ruff === 'none')) return plan;
  const k = scaleOf(plan), J = { ...plan.joints }, segments = [...plan.segments], RJ = plan.rig.joints;
  const at = (id) => RJ[id]?.at ?? J[id];
  // a flat part out of a surface point along `out`, raked along `rake`: sunk under it, thin across x, wide in the plane
  // its axis leans in (station-loft-plan.js superellipse: R toward +x)
  const fin = (name, p, out, rake, h, w, bone, group) => {
    const dir = unit(add(out, mul(rake, RIDGE.rake)));
    J[`${name}b`] = sub(p, mul(out, RIDGE.sunk * h)).map(r6); J[`${name}t`] = add(p, mul(dir, h)).map(r6);
    segments.push({ name, kind: 'segment', from: `${name}b`, to: `${name}t`, rA: [r6(Math.min(RIDGE.thick * k, 0.35 * w)), r6(w)], rB: [r6(0.003 * k), r6(0.005 * k)], group, bind: { bone } });
  };
  // THE RIDGE: up the neck's back, down the trunk's back-centre, down the tail's top
  if (D.ridge === 'spines') {
    const SG = D.spines ? 'Spines' : 'Claws', SK = D.spines?.scale ?? 1;
    const hub = at('neckHub'), base = at('headBase'), neck = segments.find((s) => s.name === 'neck'), ax = unit(sub(base, hub));
    const back = unit([0, -ax[2], ax[1]]), rN = Array.isArray(neck?.rA) ? neck.rA[1] : neck?.rA ?? 0.05;
    RIDGE.neck.forEach((h, i) => { const t = 0.3 + 0.35 * i, p = add(lerp(hub, base, t), mul(back, rN * (1 - 0.15 * t))); fin(`spineNeck${i}`, p, back, mul(ax, -1), h * k * SK, 0.55 * h * k * SK, 'neck', SG); });
    const top = hub[2] - 0.03 * k, low = (at('pelvisHub') ?? J.hip)[2] + 0.04 * k, n = RIDGE.back.length, navel = at('navel')?.[2] ?? (top + low) / 2;
    RIDGE.back.forEach((h, i) => {
      const z = top + (low - top) * (i / (n - 1)), X = sectionAt(segments, z), p = [0, X.yc - X.ry, z];
      const bone = z > navel ? 'torso' : z > (at('pelvisHub')?.[2] ?? 0) + 0.06 * k ? 'lumbar' : 'pelvis';
      fin(`spineBack${i}`, p, [0, -1, 0], [0, 0, -1], h * k * SK, 0.55 * h * k * SK, bone, SG);
    });
    const tail = segments.find((s) => s.name === 'tail' && s.kind === 'loft');
    if (tail) {
      const S = tail.stations, m = S.length - 1;
      RIDGE.tail.forEach((h, j) => {
        const i = j + 1; if (i >= m) return;
        const u = unit(sub(S[i + 1].at, S[i - 1].at)), up = unit(sub([0, 0, 1], mul(u, u[2]))), p = add(S[i].at, mul(up, S[i].r));
        fin(`spineTail${j}`, p, up, u, h * k * SK, 0.6 * h * k * SK, `tail${Math.min(i, m - 1)}`, SG);
      });
    }
  }
  // THE RUFF: two rows of tufts fanned round the back and the sides of the neck's root, hanging out and down
  if (D.ruff === 'ruff') {
    const hub = at('neckHub');
    for (const [ri, row] of RUFF.rows.entries()) {
      const z = hub[2] + row.dz * k, X = sectionAt(segments, z);
      for (let i = 0; i < row.n; i++) {
        const deg = row.from + ((row.to - row.from) * i) / (row.n - 1) + (ri % 2 ? 0 : -6), th = (deg * Math.PI) / 180;
        const sn = Math.sin(th), cs = Math.cos(th), p = [X.rx * sn, X.yc + X.ry * cs, z], out = unit([sn / X.rx, cs / X.ry, 0]);
        const L = row.len * k, dir = unit(add(out, [0, 0, -RUFF.hang])), mid = Math.abs(sn) < 1e-6, id = `ruff${ri}${i}`, name = `${id}${mid ? '' : 'R'}`;
        J[`${id}b`] = sub(p, mul(dir, RUFF.sunk * L)).map(r6); J[`${id}t`] = add(p, mul(dir, L)).map(r6);
        segments.push({ name, kind: 'segment', from: `${id}b`, to: `${id}t`, rA: [r6(RUFF.root[0] * k), r6(RUFF.root[1] * k)], rB: [r6(0.004 * k), r6(0.004 * k)],
          group: 'Skin', ...(mid ? {} : { mirror: 'name' }), bind: { bone: 'torso' } });
      }
    }
  }
  return { ...plan, joints: J, segments };
}
