/**
 * THE AUDIT: a plan someone wrote, read against the sheet it was written from (the creature-from-sheet catalyst). It
 * authors nothing. Three readings, all advisory (the machine gate; the eyes gate is the operator's):
 *
 *   auditPlan(sheet, call, { dials? }) → { door, expands, error?, ledger, lessons, sameness, summary }
 *
 *   call     a create_character call ({ as, spec }), a creature `spec`, or a bare ring plan
 *   dials    the stored dial values once minted (the lean is set after the mint)
 *   ledger   one row per sheet note: `carried` (the plan has what the note asks for), `missing` (it has not), or `eyes`
 *            (no machine can tell: a frame's ideal, the warmth of a palette); each with the evidence
 *   lessons  the checks the creature loop learned the hard way (the catalyst's lessons table), each ok or a warning
 *   sameness whether the body's joint table is a served example's rescaled (planFromSheet's biped): designed, not copied
 *
 * Pure: it expands the plan (station-loft-plan.js expandPlan) to read what the mint would refuse, and nothing else.
 */
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { BIPED_TEMPLATE } from './plan.js';

const SAME_EPS = 0.02;
const FOCAL_KINDS = ['medallion', 'boss', 'facing', 'ring', 'skull'];
const QUIET = /leather|stitch|wrap|satchel|cloth|cord/i;

const has = (re, s) => re.test(s);
const lower = (s) => String(s).toLowerCase();

function planOf(call) {
  if (call?.spec?.plan) return { as: call.as || 'creature', plan: call.spec.plan };
  if (call?.as === 'hero') return { as: 'hero', spec: call.spec };
  if (call?.plan) return { as: 'creature', plan: call.plan };
  if (call?.schema) return { as: 'creature', plan: call };
  return { as: 'hero', spec: call?.spec || call };
}

/** the body's height: the neck top's height over the share of the height it sits at (the served bodies' 0.93) */
const heightOf = (plan) => (plan.joints?.neckTop?.[2] ?? 1.86) / 0.93;

function headPlans(plan) { return (plan.heads || []).map((h) => h.plan).filter(Boolean); }
function headOrnaments(plan) { return headPlans(plan).flatMap((h) => h.ornaments || []); }
function tiles(plan) { return plan.body?.tiles || []; }
function adorn(plan) { return plan.adorn || []; }
function segs(plan) { return plan.segments || []; }
function sigKinds(plan) { return adorn(plan).map((a) => a.signature?.kind).filter(Boolean); }
function leanOf(plan, dials) { return dials?.lean ?? plan.dials?.lean?.rest ?? 0; }

function digitigrade(plan) {
  const J = plan.joints || {};
  return !!(J.hock && J.knee && J.toeBase && J.hock[2] > J.toeBase[2] + 0.08 * heightOf(plan) && J.hock[1] < J.knee[1]);
}
function armPairs(plan) { return segs(plan).filter((s) => /^upperArm.*R$/.test(s.name)).length; }
function coverGroups(plan) { return tiles(plan).flatMap((t) => (Array.isArray(t.group) ? t.group : [t.group])).map(lower); }
function ruffTiles(plan) { return tiles(plan).filter((t) => t.parts?.includes('neck') || (t.parts?.includes('torso') && t.s?.[0] >= 2.8)); }
function colours(plan) {
  const out = new Set();
  for (const v of Object.values(plan.palette || {})) out.add(lower(v));
  for (const h of headPlans(plan)) for (const v of Object.values(h.palette || {})) out.add(lower(v));
  for (const s of segs(plan)) if (s.tint) out.add(lower(s.tint));
  return out;
}

/** does the plan carry this note? → [verdict, evidence] */
function carries(sheet, plan, dials, ch, line) {
  const L = lower(line);
  switch (ch) {
    case 'frame':
      if (has(/tail/, L)) return segs(plan).some((s) => /tail/.test(s.name)) ? ['carried', 'a tail segment'] : ['missing', 'no tail segment'];
      if (has(/digitigrade/, L)) return digitigrade(plan) ? ['carried', 'the hock raised behind the knee'] : ['missing', 'the legs are not digitigrade'];
      if (has(/second pair of arms/, L)) return armPairs(plan) >= 2 ? ['carried', `${armPairs(plan)} arm pairs`] : ['missing', 'one arm pair'];
      if (has(/coil|serpent/, L)) return segs(plan).some((s) => s.kind === 'chain' && s.joints?.length >= 8) ? ['carried', 'a long chain'] : ['missing', 'no long chain'];
      if (has(/child cast/, L)) return ['eyes', 'proportion'];
      return ['eyes', 'a frame reading'];
    case 'structure':
      if (!headPlans(plan).length) return ['missing', 'no head'];
      return has(/muzzle|snout|beak|mandible|tusk|jaw|bone|skull|face|nose/, L) ? ['eyes', `a head is worn (${headPlans(plan).map((h) => h.name).join(', ')}); its shape is for the eyes`] : ['eyes', 'a face reading'];
    case 'colouring': {
      const want = sheet.ancestry?.colours?.Skin && lower(sheet.ancestry.colours.Skin);
      return want && colours(plan).has(want) ? ['carried', `the swatch ${want}`] : ['missing', `the sheet's swatch ${want} is not in the palette or tints`];
    }
    case 'cover': {
      const g = coverGroups(plan).join(' ');
      if (!tiles(plan).length) return ['missing', 'no tiles'];
      if (has(/ruff/, L)) return ruffTiles(plan).length ? ['carried', 'tiles on the neck and the upper torso'] : ['missing', 'no tiles at the neck'];
      for (const [word, re] of [['fur', /fur/], ['scale', /scale|scute/], ['chitin', /chitin|plate/], ['bone', /bone/]]) if (has(re, L)) return has(new RegExp(word), g) || (word === 'scale' && /scute|plate/.test(g)) ? ['carried', `${word} tiles`] : ['eyes', `tiles (${g || 'no groups'}): whether they read as ${word} is for the eyes`];
      return ['carried', 'tiles'];
    }
    case 'ornament': {
      const names = headOrnaments(plan).map((o) => lower(o.name || o.kind)).join(' ') + ' ' + adorn(plan).map((a) => lower(a.id)).join(' ');
      if (has(/claw|talon/, L)) return (plan.details || []).some((d) => d.kind === 'claw') ? ['carried', 'claws'] : ['missing', 'no claws'];
      for (const w of ['ear', 'horn', 'tusk', 'antenn', 'spur']) if (L.includes(w)) return names.includes(w) ? ['carried', `a ${w} ornament`] : ['missing', `no ${w} ornament`];
      return ['eyes', 'an ornament reading'];
    }
    case 'rest':
      return Object.keys(plan.heads?.[0]?.expression || {}).length ? ['carried', 'the head\'s expression controls'] : ['missing', 'the head wears no expression'];
    case 'eyes':
      return Object.keys(plan.heads?.[0]?.expression || {}).length || has(/pupil|iris|amber|eyes one|compound/, L) ? ['eyes', 'the eye region and the expression'] : ['missing', 'no expression'];
    case 'stance': {
      const lean = leanOf(plan, dials), clips = Object.keys(plan.clips || {});
      if (has(/stoop|lean|hunch|forward/, L)) return lean >= 8 ? ['carried', `lean ${lean}°`] : ['missing', `lean ${lean}°`];
      return clips.length ? ['eyes', `clips ${clips.join(', ')}`] : ['missing', 'no clips: the rig holds no stance'];
    }
    case 'silhouette':
      if (has(/burden|carried|pack/, L)) return sigKinds(plan).includes('pack') ? ['carried', 'a pack signature'] : ['missing', 'nothing carried'];
      if (has(/a pair|familiar/, L)) { const fam = [...segs(plan).map((x) => x.name), ...adorn(plan).map((a) => a.id), ...(plan.details || []).map((d) => d.name)].filter((n) => /familiar|companion/i.test(n));
        return fam.length ? ['carried', `a familiar (${fam.join(', ')}); whether the pair reads as one is for the eyes`] : ['missing', 'no familiar in this plan (name its parts familiar…)']; }
      if (has(/wings/, L)) return segs(plan).some((s) => /wing/i.test(s.name)) || adorn(plan).some((a) => /wing/i.test(a.id)) ? ['carried', 'wings'] : ['missing', 'no wings'];
      return ['eyes', 'a silhouette reading'];
    case 'dress': {
      if (!adorn(plan).length) return ['missing', 'no adornments'];
      if (has(/bandage/, L)) return adorn(plan).some((a) => a.mode === 'band' || /wrap|bandage/i.test(a.id)) ? ['carried', 'a band'] : ['missing', 'no band'];
      if (has(/satchel/, L)) return sigKinds(plan).includes('pack') ? ['carried', 'a pack signature'] : ['missing', 'no satchel'];
      if (has(/emblem|insignia|medallion|focal/, L)) return sigKinds(plan).some((k) => FOCAL_KINDS.includes(k)) ? ['carried', 'a focal signature'] : ['missing', 'no focal piece'];
      if (has(/coverage|armou?r/, L)) return adorn(plan).some((a) => a.rigid) ? ['carried', 'rigid shells'] : ['missing', 'no armour shells'];
      return ['eyes', 'a dress reading'];
    }
    case 'wear':
      return headPlans(plan).some((h) => (h.regions?.wrinkles || []).some((w) => w.rest > 0.3)) ? ['carried', 'wrinkles kept at rest'] : ['missing', 'no lines at rest'];
    default:
      return ['eyes', `a ${ch} reading`];
  }
}

function lessonsOf(sheet, plan, dials, expand) {
  const out = [];
  const add = (id, ok, note) => out.push({ id, ok, ...(ok ? {} : { note }) });
  add('head', headPlans(plan).length > 0, 'no head: the rig needs a skull anchor (headTop, the jaw); wear the nearest library skull or draw one');
  const floating = headPlans(plan).filter((h) => h.units && h.units.scale !== 1 && (h.ornaments || []).some((o) => o.space === 'world'));
  add('world-sweeps', !floating.length, `a scaled head keeps 'world' sweeps (${floating.map((h) => h.name).join(', ')}): they will float off the skull; make them 'head' space`);
  add('windows', !(expand.error && /address|tiles|window/.test(expand.error)), expand.error);
  const k = heightOf(plan) / 2, neck = segs(plan).find((s) => s.name === 'neck');
  const neckR = neck ? Math.max(...[].concat(neck.rA)) : 0;
  add('mass-before-cover', !(ruffTiles(plan).length && neckR < 0.18 * k), `a ruff of tiles on a neck of radius ${neckR}: give the neck and shoulders the mass first (≥ ${(0.18 * k).toFixed(2)})`);
  const stooped = Object.values(sheet.notes).flat().some((n) => /stoop|forward-leaning|hunched/.test(n.line));
  const lean = leanOf(plan, dials);
  add('lean', !(stooped && lean < 15), `the sheet stoops and the lean is ${lean}°: under 15° it does not read at distance`);
  const focal = adorn(plan).filter((a) => FOCAL_KINDS.includes(a.signature?.kind) && !QUIET.test(a.signature?.group || ''));
  add('one-focal', focal.length <= 1, `${focal.length} focal metal pieces (${focal.map((a) => a.id).join(', ')}): keep one; mended straps take stitches or studs`);
  const ruffParts = new Set(ruffTiles(plan).flatMap((t) => t.parts));
  const over = adorn(plan).filter((a) => (a.part === 'neck' || (a.part === 'torso' && a.s?.[0] >= 2.8)) && ruffParts.has(a.part) && a.mugen > 0.03 * k);
  add('stack', !over.length, `adornments over the ruff stand off ${over.map((a) => `${a.id} ${a.mugen}`).join(', ')}: keep straps thin and low under the iconic feature`);
  const big = headPlans(plan).filter((h) => { const nose = (h.ornaments || []).find((o) => o.name === 'nose'); const rows = h.parts?.cranium?.rows; if (!nose || !rows) return false;
    const cheek = rows[rows.length - 1][2].cheek; const w = Array.isArray(cheek) ? cheek[0] : null; return w && nose.radii[0] * (nose.squash?.[0] ?? 1) > 0.7 * w; });
  add('ornament-scale', !big.length, `the nose pad is wider than 0.7 of the muzzle it sits on (${big.map((h) => h.name).join(', ')}): it reads as an open mouth`);
  return out;
}

/** a joint's name as the template knows it: `shoulderR`, `shoulder$S`, `shoulder1` all read as `shoulder` */
const baseName = (n) => n.replace(/\$S$/, '').replace(/[RL]$/, '').replace(/1$/, '');

/** the joint table normalised by height, against the served biped's: designed, or the template rescaled? */
function samenessOf(plan) {
  const H = heightOf(plan), J = {};
  for (const [n, p] of Object.entries(plan.joints || {})) { const b = baseName(n); if (!J[b] || n === b) J[b] = p; }
  const rows = [];
  for (const [legs, T] of Object.entries(BIPED_TEMPLATE)) {
    const names = Object.keys(T).filter((n) => J[n]);
    if (names.length < 8) { rows.push({ template: `biped (${legs})`, unchecked: `${names.length} of its joints found` }); continue; }
    const d = Math.max(...names.flatMap((n) => [Math.abs(J[n][1] / H - T[n][1] / 2), Math.abs(J[n][2] / H - T[n][2] / 2)]));
    rows.push({ template: `biped (${legs})`, worst: Math.round(d * 1000) / 1000 });
  }
  const copied = rows.filter((r) => r.worst < SAME_EPS);
  const checked = rows.some((r) => r.worst != null);
  return { flagged: copied.length > 0, checked, against: rows, ...(copied.length ? { note: `the joint table is the served ${copied[0].template} rescaled (every joint within ${SAME_EPS} of the height): design the topology from the notes` } : {}) };
}

function heroLedger(sheet, spec) {
  const at = { colouring: () => spec.palette?.Skin && 'palette', rest: () => spec.expression && 'expression', eyes: () => (spec.expression || spec.sculpt || spec.face) && 'expression, sculpt, face',
    structure: () => (spec.face || spec.look || spec.headPreset || spec.sculpt) && 'face, look, headPreset, sculpt', stance: () => spec.gesture && 'gesture', frame: () => (spec.cast || spec.tune || spec.body) && 'cast, tune, body',
    hair: () => spec.hair && 'hair', dress: () => (spec.detail || spec.adorn || spec.outfit || spec.paint) && 'detail, adorn, outfit, paint', palette: () => spec.palette && 'palette', silhouette: () => (spec.tune || spec.gear || spec.adorn) && 'tune, gear, adorn' };
  return Object.entries(sheet.notes).flatMap(([ch, notes]) => notes.map((n) => {
    const v = at[ch]?.();
    return { channel: ch, line: n.line, from: n.from, verdict: v ? (['rest', 'colouring', 'hair'].includes(ch) ? 'carried' : 'eyes') : (['cover', 'ornament', 'wear', 'structure'].includes(ch) ? 'missing' : 'eyes'), evidence: v ? `spec.${v}` : 'not in the hero spec' };
  }));
}

export function auditPlan(sheet, call, { dials } = {}) {
  const c = planOf(call);
  if (c.as === 'hero') {
    const ledger = heroLedger(sheet, c.spec || {});
    return { door: 'hero', expands: true, ledger, lessons: [], sameness: { flagged: false, against: [] }, summary: summary(ledger, []) };
  }
  const plan = c.plan;
  const expand = (() => { try { expandPlan(plan); return {}; } catch (e) { return { error: e.message }; } })();
  const ledger = Object.entries(sheet.notes).flatMap(([ch, notes]) => notes.map((n) => { const [verdict, evidence] = carries(sheet, plan, dials, ch, n.line); return { channel: ch, line: n.line, from: n.from, verdict, evidence }; }));
  const lessons = lessonsOf(sheet, plan, dials, expand);
  const sameness = samenessOf(plan);
  return { door: 'creature', expands: !expand.error, ...(expand.error ? { error: expand.error } : {}), ledger, lessons, sameness, summary: summary(ledger, lessons, sameness) };
}

function summary(ledger, lessons, sameness) {
  const n = (v) => ledger.filter((r) => r.verdict === v).length;
  return { carried: n('carried'), missing: n('missing'), eyes: n('eyes'), warnings: lessons.filter((l) => !l.ok).map((l) => l.id).concat(sameness?.flagged ? ['sameness'] : []),
    note: 'carried means the plan HAS what the note asks for, not that it reads: the look and the eyes gate decide that' };
}
