/**
 * THE FINISHES of a building level, shown before it is built: what each surface will wear, read off the stage the level
 * is built as (planStage: its composed look, its art direction, its recipe tiles, its grime), each surface's tile painted
 * as the build paints it (matte-paint/dressed.js, at the metres it is laid at), through the level's tone when it has one
 * (era/tone.js: the tile's value picks its colour off its surface's ramp), and the light its plot hangs. The world's book
 * shows them on each building level and, a row a layer, on the walled-core dungeon's page, so a draft is approved on
 * its materials, not on its colours alone.
 *
 *   finishesOf(stage, { palette }) → { kitId, axes, toned, dropped, tiles: [{ role, cut, metres, id, png }], light }
 *     `dropped`: the level's palette, which a bay building does not take (levels.js inPalette paints an art-directed room
 *     kit only): the look's palette colours it, or its tone
 *   finishesCss(list) → one rule a tile, so a tile shown twice is carried once
 *   finishesHtml(F, esc, { roles }) → a row of tiles and the light
 *
 * Pure: the same stage, the same finishes.
 */
import { planStage } from '../era/stage.js';
import { withProgram } from '../era/programs.js';
import { rampAt } from '../era/tone.js';
import { familyKeys, generatedSpecOf, encodePng } from '../landscape/surface-textures.js';
import { dressedTile } from '../matte-paint/dressed.js';

// the surfaces a finishes board shows, in the order a room is read (what is around you, underfoot, overhead, the accent)
export const FINISH_ROLES = Object.freeze(['wall', 'base', 'floor', 'column', 'crown', 'ceiling', 'paint', 'band']);
// the fixtures whose colour a board shows: the key's (strips, high bays), the secondary's (the cove), the doors', the downlights'
const FIXTURES = ['highbay', 'strip', 'cove', 'door', 'down'];
const SIZE = 96;
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(36); }

/** A tile's texels through a tone ramp: each texel's value picks its colour. */
function toned(rgb, ramp) {
  const out = Buffer.alloc(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const c = rampAt(ramp, (0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]) / 255);
    out[i] = Math.round(c[0] * 255); out[i + 1] = Math.round(c[1] * 255); out[i + 2] = Math.round(c[2] * 255);
  }
  return out;
}

/** What a building level's stage will wear. */
export function finishesOf(stage, { palette = null } = {}) {
  const plan = planStage({ ...withProgram(stage), props: false }), K = plan.kit, T = plan.tone ?? null;
  const tiles = [];
  for (const role of FINISH_ROLES) {
    const fam = K.tiles?.[role]?.family, S = fam ? generatedSpecOf(familyKeys(fam)[0]) : null;
    // (a surface laid from the library, or from a generator that is no dressed cut, has no tile to paint here)
    if (!S || S.gen !== 'dressed') continue;
    const { rgb, W, H } = dressedTile(S.cfg, { size: SIZE, seed: S.seed });
    const ramp = T ? T.ramps[T.groups?.[`stage:${role}`] ?? T.default] : null;
    const png = `data:image/png;base64,${encodePng(ramp ? toned(rgb, ramp) : rgb, W, H).toString('base64')}`;
    tiles.push({ role, cut: S.cfg.cut, metres: S.cfg.metres, id: `fin-${hash(png)}`, png });
  }
  const L = K.B?.light ?? {};
  const light = FIXTURES.filter((f) => L[f]?.color).map((f) => ({ fixture: f, color: L[f].color }));
  return { kitId: plan.kitId, axes: plan.compose?.axes ?? null, toned: !!T, dropped: !!palette && stage.art === undefined && !T, tiles, light };
}

/** One rule a tile, for every tile on a page: a tile shown on its level and on the dungeon's page is carried once. */
export function finishesCss(list) {
  const seen = new Map();
  for (const F of list) for (const t of F?.tiles ?? []) seen.set(t.id, t.png);
  return [...seen].map(([id, png]) => `.${id}{background-image:url(${png})}`).join('')
    + '.fin{display:flex;flex-wrap:wrap;gap:8px}.fin figure{margin:0;width:92px}.fin i{display:block;width:92px;height:72px;background-size:cover;border:1px solid var(--rule);border-radius:3px}'
    + '.fin figcaption{font:10px/1.3 var(--mono);color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.04em}'
    + '.fin-light{display:flex;gap:6px;align-items:center;margin-top:6px;font:10px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.04em}'
    + '.fin-light b{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid var(--rule);vertical-align:-2px;margin-right:3px}'
    + '.fin-row{display:flex;gap:3px}.fin-row i{display:block;width:26px;height:26px;background-size:cover;border:1px solid var(--rule);border-radius:2px}';
}

/** A level's finishes: its tiles, captioned, and its light. `roles` keeps some of them, as small squares in a row. */
export function finishesHtml(F, esc, { roles = null } = {}) {
  if (!F || !F.tiles.length) return '';
  if (roles) return `<span class="fin-row">${F.tiles.filter((t) => roles.includes(t.role)).map((t) => `<i class="${t.id}" title="${esc(`${t.role} · ${t.cut}`)}"></i>`).join('')}</span>`;
  const tiles = F.tiles.map((t) => `<figure><i class="${t.id}"></i><figcaption>${esc(t.role)}<br>${esc(t.cut)} · ${t.metres} m</figcaption></figure>`).join('');
  const light = F.light.length ? `<div class="fin-light">light ${F.light.map((l) => `<span><b style="background:${l.color}"></b>${esc(l.fixture)}</span>`).join(' ')}</div>` : '';
  const says = [F.axes ? `${F.axes.construction} · ${F.axes.palette}` : F.kitId, F.toned ? 'coloured by its tone' : '', F.dropped ? 'its palette does not colour a bay building: these are its look\'s colours' : ''].filter(Boolean);
  return `<div class="fin">${tiles}</div>${light}<p class="muted mono">${esc(says.join(' · '))}</p>`;
}
