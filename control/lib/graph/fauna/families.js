// The body FAMILIES: one module per family under families/, each exporting `family` (the tables a body plan shares,
// authored at the family's own size) and `species` (the numbers over those tables that make each animal). Read
// build.js for what every field does. A family is nailed on ONE worked species before any other species uses it.
import * as canine from './families/canine.js';
import * as feline from './families/feline.js';
import * as equine from './families/equine.js';
import * as cervid from './families/cervid.js';
import * as bovid from './families/bovid.js';
import * as ursine from './families/ursine.js';
import * as pachyderm from './families/pachyderm.js';
import * as procyonid from './families/procyonid.js';
import * as macropod from './families/macropod.js';
import * as mustelid from './families/mustelid.js';
import * as monotreme from './families/monotreme.js';
import * as rodent from './families/rodent.js';
import * as avian from './families/avian.js';

// a family module exports `family: null` until it is built; it then joins the roster with its species
const MODULES = Object.fromEntries(Object.entries({ canine, feline, equine, cervid, bovid, ursine, pachyderm, procyonid, macropod, rodent, mustelid, monotreme, avian }).filter(([, m]) => m.family));

export const FAMILIES = Object.freeze(Object.fromEntries(Object.entries(MODULES).map(([k, m]) => [k, m.family])));
/** Every species of every family, keyed by id, each tagged with its family. */
export const FAMILY_SPECIES = Object.freeze(Object.fromEntries(Object.entries(MODULES).flatMap(([k, m]) => Object.entries(m.species || {}).map(([id, s]) => [id, { family: k, ...s }]))));
