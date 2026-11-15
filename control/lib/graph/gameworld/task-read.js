/**
 * A LEVEL'S TASKS, READ (tasks.js lays them): kept apart and light, so the world's reader takes no more than it needs.
 *   TASK_KINDS · readTasks(v, { fights, at })   (see tasks.js)
 * Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const TASK_KINDS = Object.freeze({ fight: 'one of the game\'s kept fights, laid in a room: sealed until its waves are down' });
export function readTasks(v, { fights = null, at = 'goal.tasks' } = {}) {
  const no = (m) => { throw new Error(`${at}${m}`); };
  if (!Array.isArray(v) || !v.length) no(' is the level\'s fights in order: [{ fight: \'<a kept fight>\', at: \'<a room>\' }, …]');
  const names = Object.keys(fights ?? {});
  v.forEach((T, k) => {
    if (!isObj(T) || typeof T.fight !== 'string' || typeof T.at !== 'string' || !T.at) no(`[${k}] is { fight: '<a kept fight>', at: '<a room of the building>' }`);
    for (const key of Object.keys(T)) if (!['fight', 'at'].includes(key)) no(`[${k}] has no '${key}' (fight, at)`);
    if (fights !== null && !names.includes(T.fight)) no(`[${k}].fight '${T.fight}' is not a fight the world keeps (${names.join(', ') || 'it keeps none: fights: { <name>: { kind } }'})`);
  });
  if (new Set(v.map((T) => T.at)).size !== v.length) no(': a room holds one fight');
  return v;
}

