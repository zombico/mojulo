// equipment/arms — modern and future arms as equipment: pistols (service, compact, heavy, revolver), the carbine, rifles
// (assault, marksman, bullpup), the submachine gun, shotguns (pump, tactical) and knives (combat, tanto, dagger,
// karambit), each in the modern or the future line and a finish card, its parts tunable by word. Built by the laws in
// laws.js for the seventh-generation look: side outlines pushed through their widths, every edge chamfered to catch
// the key, materials told apart by how they reflect, the bore one line, detail in three tiers.
//
//   build: { type: 'equipment', item, model?, line?, style?, parts?, dials?: { stylize, mass }, laws? }
//     item    pistol | carbine | shotgun | rifle | smg | knife
//     model   the archetype (models.js ARM_MODELS); absent → the item's default
//     line    'modern' | 'future'; absent → the finish card's
//     style   a finish (finishes.js: black, fde, od, stainless, walnut; white, gunship, titan, hazard; the firearm
//             samples' service and future) or an inline finish card
//     parts   slot → word: barrel, stock, magazine, optic, muzzle, rail, underbarrel, grip; a knife's blade, length,
//             guard, handle, serrations (the model's `takes` names what each slot takes)
//
// A pistol, a carbine or a shotgun build that names none of model, line or parts is the firearm samples' (firearm.js),
// byte for byte; the mint stamps the item's default model on a new one (stampArms), so a new mint is drawn here.
// The frame is the firearm's: the bore along +z at y = 0, +y up, x across, centimetres; a knife's is the sword's (the
// pommel at z = 0, the blade up +z, its edge toward +x). Pure and deterministic: no dice.
import { ARM_MODELS, ARMS_ONLY_ITEMS, ARM_ITEMS, armClass } from './models.js';
import { ARM_FINISHES, FINISH_ALIASES, finishCardOf, validateFinishCard, rolesOf } from './finishes.js';
import { ARMS_LAWS_VERSION, ARMS_LAWS, LINES, chamferOf, pitchOf, armsProportion, GUARD_OPENING } from './laws.js';
import { buildPistol, buildRevolver } from './handguns.js';
import { buildLongGun, buildBullpup, buildShotgun } from './longguns.js';
import { buildKnife } from './knives.js';

export { ARM_MODELS, ARM_ITEMS, ARMS_ONLY_ITEMS, ARM_FINISHES, ARMS_LAWS_VERSION, ARMS_LAWS, LINES, armClass };
const BUILDERS = { pistol: buildPistol, revolver: buildRevolver, long: buildLongGun, bullpup: buildBullpup, shotgun: buildShotgun, knife: buildKnife };
const SAMPLE_FIREARMS = ['pistol', 'carbine', 'shotgun'];
const r3 = (v) => Math.round(v * 1000) / 1000;
const an = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
const finishNames = () => [...Object.keys(ARM_FINISHES), ...Object.keys(FINISH_ALIASES)];

/** Whether a build is drawn by the arms kernel: an arms-only item, or a sample firearm naming a model, a line, parts,
 * or a finish of the arms' own (a name the firearm samples do not carry, or a card with a `frame` role). */
export function isArmsBuild(build) {
  if (!build || typeof build !== 'object') return false;
  if (ARMS_ONLY_ITEMS.includes(build.item)) return true;
  if (!SAMPLE_FIREARMS.includes(build.item)) return false;
  const st = build.style;
  return build.model !== undefined || build.line !== undefined || build.parts !== undefined
    || (typeof st === 'string' && Object.hasOwn(ARM_FINISHES, st)) || (!!st && typeof st === 'object' && !!st.roles?.frame);
}

/** The stored build with the item's default model stamped on an arm that names none (the mint's: a new mint is drawn
 * by the arms kernel, a row minted before keeps the firearm samples' bytes). Anything else passes through. */
export function stampArms(build) {
  if (!build || typeof build !== 'object' || !ARM_MODELS[build.item] || build.model !== undefined) return build;
  return { ...build, model: ARM_MODELS[build.item].default };
}

const modelOf = (build) => ARM_MODELS[build.item]?.models[build.model ?? ARM_MODELS[build.item].default];

/** Why an arms build is invalid (sentences naming the choices); empty when valid. */
export function validateArmsBuild(build) {
  const errs = [], item = ARM_MODELS[build.item];
  if (!item) return [`build.item: '${build.item}' is not an arm (${ARM_ITEMS.join(', ')})`];
  const M = modelOf(build);
  if (!M) return [`build.model: '${build.model}' is not a ${build.item} model (${Object.keys(item.models).join(', ')})`];
  if (build.line !== undefined && !LINES.includes(build.line)) errs.push(`build.line: '${build.line}' is not a line (${LINES.join(', ')})`);
  if (build.style !== undefined) {
    if (typeof build.style === 'string') { if (!finishCardOf(build.style)) errs.push(`build.style: '${build.style}' is not a finish (${finishNames().join(', ')}); or pass an inline finish card`); }
    else errs.push(...validateFinishCard(build.style, 'build.style'));
  }
  const parts = build.parts;
  if (parts !== undefined && (parts === null || typeof parts !== 'object' || Array.isArray(parts))) errs.push(`build.parts: { ${Object.keys(M.takes).join(', ')} } for ${an(build.model ?? item.default)} ${build.item}`);
  else for (const [slot, v] of Object.entries(parts || {})) {
    const words = M.takes[slot];
    if (!words) { errs.push(`build.parts.${slot}: ${an(build.model ?? item.default)} ${build.item} takes ${Object.keys(M.takes).join(', ')}`); continue; }
    const lengths = slot === 'barrel' ? M.barrel : slot === 'length' ? M.length : null;
    if (lengths && typeof v === 'number') { if (!(Number.isFinite(v) && v >= 4 && v <= 90)) errs.push(`build.parts.${slot}: a length in centimetres, 4–90, or a word (${words.join(', ')})`); }
    else if (!words.includes(v)) errs.push(`build.parts.${slot}: '${v}' is not one of ${words.join(', ')}${lengths ? ' (or a length in cm)' : ''}`);
  }
  const d = build.dials || {};
  for (const k of Object.keys(d)) if (!['stylize', 'mass', 'focus', 'ornament'].includes(k)) errs.push(`build.dials.${k}: an arm takes stylize and mass`);
  if (d.stylize !== undefined && !(Number.isFinite(d.stylize) && d.stylize >= 0 && d.stylize <= 1)) errs.push('build.dials.stylize: a number 0–1');
  if (d.mass !== undefined && !(Number.isFinite(d.mass) && d.mass >= 0.5 && d.mass <= 2)) errs.push('build.dials.mass: a number 0.5–2');
  if (build.gem !== undefined && build.gem !== null) errs.push('build.gem: an arm takes no stone (its finish card is its look)');
  if (build.seed !== undefined && !Number.isInteger(build.seed)) errs.push('build.seed: an integer');
  if (build.laws !== undefined && build.laws !== ARMS_LAWS_VERSION) errs.push(`build.laws: ${build.laws} is unknown — this kernel carries arms laws ${ARMS_LAWS_VERSION}`);
  return errs;
}

/** The build's resolved words: its model's row, the line, the finish card, every part (the line's defaults under the
 * build's own). */
export function resolveArm(build) {
  const item = ARM_MODELS[build.item], model = build.model ?? item.default, M = item.models[model];
  const card = finishCardOf(build.style, build.line);
  const line = build.line ?? card.line ?? 'modern';
  const parts = { ...M.parts, ...(line === 'future' ? M.future || {} : {}), ...(build.parts || {}) };
  return { item: build.item, model, M, card, line, parts, finish: typeof build.style === 'string' ? (FINISH_ALIASES[build.style] ?? build.style) : card.id ?? (build.style ? 'inline' : card.id) };
}

/** Build an arm (a valid build) → { monomers, sockets, trace }. */
export function buildArm(build) {
  const errs = validateArmsBuild(build);
  if (errs.length) throw new Error(`Invalid arms build:\n- ${errs.join('\n- ')}`);
  const { item, model, M, card, line, parts, finish } = resolveArm(build);
  const stylize = build.dials?.stylize ?? 0, mass = build.dials?.mass ?? 1;
  const m = {}, chamfers = [];
  const c = {
    item, model, line, parts, P: armsProportion({ stylize, mass }), R: rolesOf(card), M, stylize,
    barrel: typeof parts.barrel === 'number' ? parts.barrel : M.barrel?.[parts.barrel],
    length: typeof parts.length === 'number' ? parts.length : M.length?.[parts.length],
    ch: (t) => { const v = chamferOf(t, { stylize, line }); chamfers.push(v); return v; },
    pitch: (b) => pitchOf(b, stylize),
    add: (k, v) => (m[k] ||= []).push(v),
  };
  const out = BUILDERS[M.build](c, M);
  const sockets = armClass(item) === 'blade'
    ? { grip: { origin: out.fist, axis: [0, 0, 1], edge: [1, 0, 0], length: r3(out.gripL) }, guard: { origin: [0, 0, r3(out.guard)] }, tip: { origin: out.tip.map(r3) } }
    : { grip: { origin: out.fist.map(r3), axis: out.axis.map(r3), length: 10 }, tip: { origin: [0, 0, r3(out.front)] }, stock: { origin: out.butt.map(r3) } };
  const length = r3((armClass(item) === 'blade' ? out.tip[2] : out.front) - out.back);
  const trace = {
    variants: { model, line, finish, ...parts },
    length, back: r3(out.back), minFeature: r3(Math.min(0.12, ...chamfers)),
    arms: lawsReadout(m, { chamfers, guard: out.guardOpening ?? null, line }),
  };
  return { monomers: m, sockets, trace };
}

/** The laws as read off the built monomers: the chamfers (law 2), the responses and the glow hues (law 3), the guard's
 * opening (law 6). Advisory: it stamps what it measured; nothing refuses. */
export function lawsReadout(m, { chamfers, guard, line }) {
  const responses = new Set(), glows = new Set();
  for (const k of ['extrudes', 'lathes', 'sweeps', 'lofts']) for (const x of m[k] || []) {
    const mat = x.material;
    // a metal surface and the bright shelf metals are bare; gunmetal is a coated metal (a nitrided slide, a coated
    // blade): the two reflect apart
    if (mat && typeof mat === 'object') { responses.add('bare'); continue; }
    if (mat === 'neon') { responses.add('glow'); glows.add(x.tint); continue; }
    responses.add(({ gunmetal: 'coated', steel: 'bare', chrome: 'bare', silver: 'bare', bronze: 'bare', gold: 'bare', copper: 'bare', glass: 'glass', plastic: 'finish', satin: 'finish', wood: 'finish', rubber: 'grip', matte: 'dark' })[mat] ?? 'finish');
  }
  const solid = [...responses].filter((r) => !['glow', 'glass', 'dark'].includes(r));
  return {
    laws: ARMS_LAWS_VERSION, line,
    chamfer: { min: r3(Math.min(...chamfers)), max: r3(Math.max(...chamfers)) },
    responses: [...responses].sort(), glowHues: glows.size,
    ...(guard != null ? { guardOpening: r3(guard) } : {}),
    advice: [
      ...(solid.length < 3 ? [`material by response: ${solid.length} solid response${solid.length === 1 ? '' : 's'} (${solid.join(', ')}); a finish card wants three (bare or coated metal, a finish, the grip)`] : []),
      ...(glows.size > 1 ? [`one glow hue: ${glows.size} drawn — a future arm spends its glow on one`] : []),
      ...(line === 'future' && !glows.size ? ['the future line draws its conduit and emitter in a glow role: this finish names none'] : []),
      ...(guard != null && guard < GUARD_OPENING ? [`negative space: the guard opens ${r3(guard)} cm, under a finger's ${GUARD_OPENING}`] : []),
    ],
  };
}
