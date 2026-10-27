/**
 * THE TABLE RPG MODULE — a pen-and-paper game as a recipe: the system it plays by, the party rolled for it (character
 * creation scoped to this one game), the world, its dungeons, foes, items, tables and beats, and the goal. Read here for
 * the kernel (table-rpg-kernel.js), checked for whether it plays (its dungeons and world), and said as TEXT: the referee
 * packet an agent runs the game from in prose, and the transcript of a game played by commands. A game in text needs
 * nothing else; a page, a map and a walkable level are drawn over the same module later.
 *
 *   readModule(module) → { K, module, checks }   module.system an id (table-rpg-systems.js) or a card written out;
 *     members' personas rolled (table-rpg-party.js); checks: { world, dungeons: { <id>: checkDungeon } }. Throws, teaching
 *   refereePacket(K, { tape? }) → markdown   the system in a paragraph and how its dice read, the attribution, the party's
 *     sheets and how each was rolled, the world, each dungeon's key room by room, the foes in the system's numbers, the
 *     tables, the goal; and a dice tape (`tape: n` rolls of the d20, d6, d10 and d100) so an agent referee rolls nothing
 *     it could choose
 *   playScript(K, commands) → { S, lines }   a game from its opening through each command (the command list is the save:
 *     play state never needs to leave the table)
 *   TABLE_RPG_KEYS
 */
import { systemOf } from './table-rpg-systems.js';
import { tableCompile, tableStart, tableAct, tableSheetLines, tableTape } from './table-rpg-kernel.js';
import { withPersonas } from './table-rpg-party.js';
import { checkDungeon } from './table-rpg-dungeon.js';
import { checkWorld } from './table-rpg-world.js';

export const TABLE_RPG_KEYS = Object.freeze(['title', 'seed', 'system', 'hook', 'goal', 'ending', 'party', 'world', 'dungeons', 'foes', 'items', 'tables', 'beats']);

const words = (s) => String(s).replace(/[-_]/g, ' ');

export function readModule(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`table rpg: a module is { ${TABLE_RPG_KEYS.join(', ')} }`);
  for (const k of Object.keys(raw)) if (!TABLE_RPG_KEYS.includes(k)) throw new Error(`table rpg: unknown key '${k}' (keys: ${TABLE_RPG_KEYS.join(', ')})`);
  const module = withPersonas({ ...raw, system: systemOf(raw.system ?? 'd20') });
  const K = tableCompile(module);
  const goalRoom = (id) => {
    const G = module.goal;
    if (G.room?.startsWith(`${id}/`)) return G.room.split('/')[1];
    if (G.cleared?.startsWith(`${id}/`)) return G.cleared.split('/')[1];
    if (G.item) return (module.dungeons[id].rooms ?? []).find((r) => (r.items ?? []).some((x) => (typeof x === 'string' ? x : x.item) === G.item))?.id;
    return undefined;
  };
  const dungeons = Object.fromEntries(Object.entries(module.dungeons ?? {}).map(([id, d]) => [id, checkDungeon(d, { items: module.items, goal: goalRoom(id) })]));
  return { K, module, checks: { world: checkWorld(module.world, { dungeons: module.dungeons }), dungeons } };
}

export function playScript(K, commands = []) {
  let { S, lines } = tableStart(K);
  lines = [...lines];
  for (const c of commands) {
    lines.push(`> ${c}`);
    const r = tableAct(K, S, c);
    S = r.S; lines.push(...r.lines);
    if (S.over) break;
  }
  return { S, lines };
}

/** How the system's dice read, in a paragraph: what to roll for a check, a fight, a level. */
function rulesDigest(sys) {
  const D = sys.check.difficulty;
  const check = {
    d20: `Roll 1d20, add the ability's modifier (and the proficiency bonus, ${2} at first level, when the ability is one of the class's two best); meet the DC to pass: easy ${D.easy}, medium ${D.medium}, hard ${D.hard}. A natural 20 is a critical, a natural 1 a fumble.`,
    under: `Roll 1d20 and pass at or under the ability score, ${D.easy > 0 ? '+' : ''}${D.easy} when easy, ${D.hard} when hard. A 1 is a critical, a 20 a fumble.`,
    bands: `Roll 2d6 and add the stat (${D.easy > 0 ? '+' : ''}${D.easy} when easy, ${D.hard} when hard): 10 or more a hit, 7–9 a hit at a cost, 6 or less a miss (and the referee makes a move).`,
    ladder: `Roll four fudge dice (−1, 0, +1 each) and add the approach; beat the rung (easy ${D.easy}, medium ${D.medium}, hard ${D.hard}): a tie succeeds at a cost, three over is success with style.`,
    percentile: 'Roll d100 at or under the score to pass (doubled when easy, halved when hard); a fifth of it or less is a critical, 96 and over a fumble.',
    action: `Roll the action die (d6), add the stat (${D.easy > 0 ? '+' : ''}${D.easy} when easy, ${D.hard} when hard), against two challenge dice (d10): beat both a strong hit, one a weak hit, neither a miss; matching challenge dice twist the result.`,
  }[sys.check.kind];
  const fight = sys.combat.foesAct
    ? (sys.combat.defence === 'armour' ? 'In a fight, roll initiative; an attack is 1d20 plus the weapon\'s modifier against the foe\'s defence, then the weapon\'s damage. Foes attack on their turns.' : 'In a fight, every side acts in turn; an attack is a check against the foe\'s own roll or score. Foes attack on their turns.')
    : `In a fight the players roll every die: an attack is a check; a hit deals the weapon's harm, ${(sys.combat.costOn ?? ['partial']).includes('partial') ? 'a hit at a cost deals it and takes the foe\'s' : 'a weak hit deals it and loses the initiative'}, a miss takes the foe's.`;
  const level = sys.progression.kind === 'xp' ? 'Defeated foes give experience; a level comes at each threshold.'
    : sys.progression.kind === 'misses' ? `Every miss marks experience; ${sys.progression.at} marks give a level.` : 'A level comes at the story\'s milestones.';
  return `${check} ${fight} ${level}`;
}

export function refereePacket(K, { tape = 20 } = {}) {
  const sys = K.sys, M = K.M, out = [];
  out.push(`# ${K.title}`, '');
  if (M.hook) out.push(M.hook, '');
  out.push(`**Goal:** ${M.goal.item ? `bring back ${K.items[M.goal.item]?.name ?? words(M.goal.item)}` : M.goal.place ? `reach ${K.places[M.goal.place].name}` : M.goal.room ? `reach ${words(M.goal.room)}` : M.goal.cleared ? `clear ${words(M.goal.cleared)}` : `the flag ${M.goal.flag}`}.`, '');
  out.push(`## The rules: ${sys.name}`, '', `${sys.about.replace(/^./, (c) => c.toUpperCase())}.`, '', rulesDigest(sys), '');
  out.push(`Checks name a faculty: ${Object.entries(sys.faculties).map(([f, a]) => `${f} → ${sys.names?.[a] ?? a}`).join(', ')}.`, '');
  if (sys.attribution) out.push(`> ${sys.attribution}`, '');
  out.push('## The party', '');
  const sheets = tableSheetLines(K, { party: K.party });
  K.party.forEach((p, i) => {
    out.push(`- ${sheets[i]}`);
    out.push(`  - made by ${p.method}: ${p.rolls.join('; ')}`);
    if (p.persona) out.push(`  - ${p.persona.reads ?? `${p.persona.archetype}, ${p.persona.role}`}`);
  });
  out.push('', '## The world', '');
  for (const P of Object.values(K.places)) {
    out.push(`- **${P.name}**${P.kind ? ` (${P.kind})` : ''}: ${P.text ?? ''}${P.dungeon ? ` The way into ${K.D[P.dungeon].name}.` : ''}`);
    for (const r of P.routes) if (P.id < r.to) out.push(`  - road to ${K.places[r.to].name}: ${r.days} day${r.days === 1 ? '' : 's'}${r.danger ? `, roll ${r.danger} each day` : ''}`);
  }
  for (const D of Object.values(K.D)) {
    out.push('', `## ${D.name}`, '', `Entry: ${D.rooms[D.entry].name}.${D.wander ? ` Resting or a loud failure rolls ${D.wander}.` : ''}`, '');
    Object.values(D.rooms).forEach((R, n) => {
      out.push(`${n + 1}. **${R.name}** (${R.id}). ${R.text ?? ''}`);
      if (R.foes?.length) out.push(`   - Foes: ${R.foes.map((f) => K.foes[f].name ?? words(f)).join(', ')}.`);
      if (R.items.length) out.push(`   - Items: ${R.items.map((x) => `${K.items[x.item].name ?? words(x.item)}${x.hidden ? ' (hidden: a search finds it)' : ''}`).join(', ')}.`);
      if (R.trap) out.push(`   - Trap: ${R.trap.text ?? 'a trap'} A ${R.trap.difficulty ?? 'medium'} ${R.trap.faculty} check, or harm.`);
      out.push(`   - Ways: ${R.exits.map((e) => `${e.L.kind}${e.L.key ? ` (${K.items[e.L.key].name ?? words(e.L.key)}${e.L.force ? `, or forced: ${e.L.force} might` : ''})` : e.L.force ? ` (forced: ${e.L.force} might)` : ''} to ${D.rooms[e.to].name}`).join('; ')}.`);
    });
  }
  out.push('', '## Foes', '');
  for (const [id, F] of Object.entries(K.foes)) {
    const st = K.foeStats(id);
    const said = sys.combat.defence === 'armour' ? `HP ${st.hp}, defence ${st.defence}, attack ${st.attack >= 0 ? '+' : ''}${st.attack}, damage ${st.damage}, ${st.xp} XP`
      : sys.combat.foesAct ? `${sys.check.kind === 'ladder' ? 'stress' : 'HP'} ${st.hp}, ${sys.check.kind === 'ladder' ? `skill +${st.attack}, defence +${st.defence}` : `attack ${st.attack}%, damage ${st.damage}`}`
        : `harm track ${st.hp}, deals ${st.damage} harm`;
    out.push(`- **${F.name ?? words(id)}** (rank ${F.rank}${F.text ? `, ${F.text}` : ''}): ${said}.`);
  }
  if (Object.keys(K.tables).length) {
    out.push('', '## Tables', '');
    for (const [id, T] of Object.entries(K.tables)) {
      out.push(`**${T.name ?? words(id)}** (${id}, ${T.die ?? '1d6'}):`, '');
      for (const r of T.rows) out.push(`- ${Array.isArray(r.on) ? `${r.on[0]}–${r.on[1]}` : r.on}: ${r.text}`);
      out.push('');
    }
  }
  if ((M.beats ?? []).length) {
    out.push('## Beats', '');
    for (const b of M.beats) out.push(`- at ${words(b.at)}: ${b.text}${b.milestone ? ' (a milestone)' : ''}`);
    out.push('');
  }
  if (tape) {
    out.push('## Dice tape', '', 'Read in order, one die at a time, so the game is fair and can be played again the same way.', '');
    for (const s of [20, 6, 10, 100]) out.push(`- d${s}: ${tableTape(K.seed, s, tape).join(' ')}`);
  }
  return out.join('\n');
}
