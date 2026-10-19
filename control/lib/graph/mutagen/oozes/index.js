// The OOZE shelf: one row per ooze (oozes/<id>.js exporting `ooze`). A new ooze is a row first; code only when a row
// needs a layer or a site kind that does not exist.
import { ooze as dire } from './dire.js';
import { ooze as skeletal } from './skeletal.js';
import { ooze as zombie } from './zombie.js';
import { ooze as frost } from './frost.js';
import { ooze as techno } from './techno.js';
import { ooze as crystal } from './crystal.js';
import { ooze as mythical } from './mythical.js';
import { ooze as fire } from './fire.js';
import { ooze as storm } from './storm.js';
import { ooze as venom } from './venom.js';
import { ooze as shadow } from './shadow.js';
import { ooze as herobot } from './herobot.js';
import { ooze as transmetal } from './transmetal.js';

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
const row = (o) => deepFreeze(structuredClone(o));

export const OOZES = Object.freeze(Object.fromEntries([dire, skeletal, zombie, frost, techno, crystal, mythical, fire, storm, venom, shadow, herobot, transmetal].map((o) => [o.id, row(o)])));
