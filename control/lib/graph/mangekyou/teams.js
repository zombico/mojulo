/**
 * THE TEAMS — where a mangekyou order is routed: the studio department that owns the design (gameworld/chapters.js
 * DEPARTMENTS), and the context that team adds to the order. A team adds context, never a code path: the vocabulary
 * its words come from (so a word is only ever swapped for another of its own kind), what it keeps out of reach, and the
 * door a kept variant goes back through. The engine is the same for every team.
 *
 *   routeOrder(manifest, { at? }) → { team, department, name, within, lock, keep, why }
 *   VOCABULARY → [{ id, axis, keys, words, ordered? }]  the house's visual words, each read only under its own keys
 *
 * A new team is a row; a new vocabulary is a row.
 */
import { DEPARTMENTS, chaptersOfPath } from '../gameworld/chapters.js';
import { OOZES } from '../mutagen/oozes/index.js';
import { REGISTER_WORDS, DETAIL_WORDS } from '../mutagen/stylism.js';
import { MOTIF_NAMES } from '../mutagen/motif.js';
import { ARM_FINISHES } from '../equipment/arms/finishes.js';
import { ARM_MODELS } from '../equipment/arms/models.js';
import { ARM_FORMS, BACK_FORMS, SEAT_FORMS } from '../furnishings/forms.js';
import { LEG_SHAPES } from '../construction/furniture-builds.js';
import { FABRIC_NAMES } from '../construction/fabric.js';
import { TIMBER_KEYS, FINISHES as TIMBER_FINISHES } from '../construction/timber.js';
import { SHEET_KEYS } from '../construction/sheets.js';
import { SKINS as PLATING_SKINS } from '../plating/styles.js';
import { SKINS as FOOTWEAR_SKINS } from '../footwear/styles.js';
import { SKINS as HANDWEAR_SKINS } from '../handwear/styles.js';
import { OUTLINES } from '../stylism/silhouette.js';
import { NAMED_SILHOUETTES } from '../stylism/silhouettes.js';

const V = (id, axis, keys, words, ordered = false) => Object.freeze({ id, axis, keys, words: Object.freeze([...new Set(words)]), ordered });
const byRank = (o) => Object.entries(o).sort((a, b) => a[1] - b[1]).map(([k]) => k);
// the arms' parts, slot by slot: the words any model's slot takes (a model that takes fewer refuses the rest at its
// mint, and the next candidate stands in); a length word is a scale, short to long
const SLOTS = {};
for (const item of Object.values(ARM_MODELS)) for (const m of Object.values(item.models ?? {})) for (const [slot, words] of Object.entries(m.takes ?? {})) {
  for (const w of words) if (typeof w === 'string') (SLOTS[slot] ??= new Set()).add(w);
}
const LENGTHS = ['short', 'standard', 'long'];
const slotRows = Object.entries(SLOTS).map(([slot, words]) => {
  const ws = [...words], ordered = ws.every((w) => LENGTHS.includes(w));
  return V(`part:${slot}`, 'silhouette', new RegExp(`^${slot}$`, 'i'), ordered ? LENGTHS.filter((w) => ws.includes(w)) : ws.sort(), ordered);
});

/** The visual words the house already speaks, each read only under a key of its own. */
export const VOCABULARY = Object.freeze([
  V('ooze', 'surface', /^oozes?$|^coat$/i, Object.keys(OOZES)),
  V('finish', 'surface', /^(finish|style)$/i, Object.keys(ARM_FINISHES)),
  V('colourway', 'colour', /^(skin|colou?rway|livery)$/i, [...Object.keys(PLATING_SKINS), ...Object.keys(FOOTWEAR_SKINS), ...Object.keys(HANDWEAR_SKINS)]),
  V('outline', 'silhouette', /^(silhouette|outline)$/i, [...OUTLINES, ...NAMED_SILHOUETTES]),
  V('motif', 'detail', /^motifs?$/i, MOTIF_NAMES),
  V('register', 'detail', /^register$/i, byRank(REGISTER_WORDS), true),
  V('detail', 'detail', /^detail$/i, byRank(DETAIL_WORDS), true),
  ...slotRows,
  // furniture as it is stored (a workbench build's dials): its forms and its finish, the words its builds take
  V('furniture:arms', 'silhouette', /^arms$/i, Object.values(ARM_FORMS).map((f) => f.arms)),
  V('furniture:back', 'silhouette', /^back$/i, Object.values(BACK_FORMS).map((f) => f.back)),
  V('furniture:cushions', 'silhouette', /^cushions$/i, Object.values(SEAT_FORMS).map((f) => f.cushions)),
  V('furniture:legs', 'silhouette', /^legs$/i, LEG_SHAPES),
  V('fabric', 'surface', /^fabric$/i, FABRIC_NAMES),
  V('timber', 'surface', /^timber$/i, TIMBER_KEYS),
  V('wood', 'surface', /^wood$/i, Object.keys(TIMBER_FINISHES)),
  V('board', 'surface', /^board$/i, SHEET_KEYS),
]);

const DEPT = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d.name]));

// a game's recipe, read whole: only the chapters a look is written in (never its levels, rules, quests or seed)
const GAME_LOOKS = Object.freeze(['/style', '/grade', '/juice', '/characters', '/foes', '/equipment', '/mounts']);
const GAME_LOCKS = Object.freeze(['/characters/hero/motion', '/characters/hero/actions', '/characters/casting']);

// what a stored kind is, by its words (the first row that hears it): a recipe of a kind not heard goes to production
// (each read against the kind's words, anchored at a word's start: 'arms' is a prop, 'farm' is not)
const KIND_TEAMS = [
  { re: /^(foe|bestiar|monster|enem|undead)/i, department: 'foes' },
  { re: /^(hero|figure|character|animal|creature|fauna|mascot|egocube|persona|body)/i, department: 'characters' },
  { re: /^(equipment|arms?$|weapon|furniture|furnish|vehicle|cars?$|craft|mecha|workbench|scad|code|solid|edifice|assembler|carved|prop|statue|layered|gear|plating|headgear|footwear|handwear)/i, department: 'characters' },
  { re: /^(world|city|geo|terrain|room|interior|building|historic|store|mall|airport|stage|level|dungeon|landscape|garden|flora|vegetation|tree)/i, department: 'worlds' },
  { re: /^(hud|menu|front|screen|ui$)/i, department: 'interface' },
];
const kindWords = (kind) => kind.split(/(?=[A-Z])|[_\-\s.]+/).filter(Boolean);

/** Where an order goes: the team that owns the design, and what it adds to the order. */
export function routeOrder(manifest, { at = '' } = {}) {
  const kind = String(manifest?.kind ?? '');
  if (kind === 'gameworld') {
    if (at) {
      const [ch] = chaptersOfPath(at);
      const department = ch?.department ?? 'production';
      return { team: department, department, name: DEPT[department], within: [at], lock: [...GAME_LOCKS], keep: 'design_game',
        why: ch ? `'${at}' is the ${ch.name.toLowerCase()} chapter's` : `'${at}' is in no chapter: production holds it` };
    }
    return { team: 'production', department: 'production', name: DEPT.production, within: [...GAME_LOOKS], lock: [...GAME_LOCKS], keep: 'design_game',
      why: 'a whole game: production takes it, and only the chapters a look is written in turn' };
  }
  const row = KIND_TEAMS.find((r) => kindWords(kind).some((w) => r.re.test(w)));
  const department = row?.department ?? 'production';
  return { team: department, department, name: DEPT[department], within: [at || ''], lock: [], keep: 'update_sketch',
    why: row ? `a '${kind}' is made in ${DEPT[department].toLowerCase()}` : `a '${kind || 'recipe'}' no team names: production takes it` };
}
