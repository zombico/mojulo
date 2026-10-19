// The OOZE shelf: one row per ooze (oozes/<id>.js exporting `ooze`). A new ooze is a row first; code only when a row
// needs a layer or a site kind that does not exist.
import { ooze as dire } from './dire.js';
import { ooze as skeletal } from './skeletal.js';
import { ooze as zombie } from './zombie.js';
import { ooze as frost } from './frost.js';
import { ooze as techno } from './techno.js';
import { ooze as crystal } from './crystal.js';

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
const row = (o) => deepFreeze(structuredClone(o));

export const OOZES = Object.freeze(Object.fromEntries([dire, skeletal, zombie, frost, techno, crystal].map((o) => [o.id, row(o)])));
