// The one-file fixture archetypes: each file exports { name, decl, build } against the builder
// contract in store-fixtures.js. Adding one is one import + one row; nothing else lives here.
import hangerRun from './hangerRun.js';
import fridgeCase from './fridgeCase.js';
import shelfWall from './shelfWall.js';
import boothSeat from './boothSeat.js';
import tillPoint from './tillPoint.js';
import queueRail from './queueRail.js';

const rows = [hangerRun, fridgeCase, shelfWall, tillPoint, queueRail, { ...boothSeat, decl: { ...boothSeat.decl, cellOnly: true } }];
export const LISTED_FIXTURES = Object.fromEntries(rows.map((m) => [m.name, { build: m.build, decl: m.decl }]));
