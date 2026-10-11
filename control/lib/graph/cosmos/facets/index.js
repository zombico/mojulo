/**
 * The six facets of a cosmos cube, in order. Each lives in its own file so a branch that builds one touches only it.
 */
import { REALITY } from './reality.js';
import { SPACE } from './space.js';
import { POWER } from './power.js';
import { SOUL } from './soul.js';
import { MIND } from './mind.js';
import { TIME } from './time.js';

export const FACETS = Object.freeze([REALITY, SPACE, POWER, SOUL, MIND, TIME]);
export const FACET_IDS = Object.freeze(FACETS.map((f) => f.id));
export const STATUSES = Object.freeze(['built', 'local', 'partial', 'absent']);
