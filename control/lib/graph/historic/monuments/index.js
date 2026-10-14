/**
 * historic/monuments — the hand-authored buildings a town is organised round: one building each, at the record's size,
 * seated on a site the way a city plan's landmark is (../../city/plan/landmarks.js). Everything round a monument (its
 * precinct wall, its approach, the town) is the solver's (../solver/); a monument is only the building.
 *
 * A monument lays itself out in its own frame, like an asset (./../assets/kit.js): its footprint [0, W] × [0, D] in
 * metres, its FRONT toward −y. `apron` is the open ground it keeps before its front (a stair's foot, colossi, an altar's
 * room). `lay(ctx)` returns its parts in that frame:
 *   slots   [{ asset, rect, facing, …params }]: built by the culture's kit, facings in the monument's frame ('n' = its front)
 *   builds  [{ id, build({ W, D }) → { boxes, grounds?, inst? }, rect, facing }]: pieces built outside a kit (the Forum's
 *           orders, whose repeated columns are instances the World draws once)
 * `kit` names the culture whose asset kit builds its slots; `cites` the ledger rows it stands on (`<record>/<id>`):
 * the anachronism check reads them, the field guide shows them. `statues`: the parts whose figures a stored statue may
 * replace (../statues.js reads the slots' own assets).
 */
import { podiumTemple, curia } from '../assets/forum.js';
import { FORUM_RECORD } from '../record/forum.js';

const recDims = (id) => FORUM_RECORD.find((e) => e.id === id).dims;

// New Kingdom Thebes: Luxor under Ramesses II, the pylon to the sanctuary, colossi and obelisks before the pylon
const LUXOR = { pylon: [62, 11], court: [46, 40], pylon2: [44, 9], hypostyle: [46, 34], sanctuary: [24, 30], gap: 4, front: 22 };
const luxorDepth = () => { const T = LUXOR; return T.pylon[1] + T.court[1] + T.pylon2[1] + T.hypostyle[1] + T.gap + T.sanctuary[1]; };

export const MONUMENTS = Object.freeze({
  'anu-ziggurat': {
    kit: 'sumer', label: 'the Anu ziggurat', read: 'a stepped mud-brick platform, its stair toward the town, the shrine above',
    cites: ['sumer/white-temple'], size: [52, 38], apron: 20,
    lay: () => ({ slots: [{ asset: 'ziggurat', rect: { x: 0, y: 0, w: 52, d: 38 }, facing: 'n' }] }),
  },
  'luxor-temple': {
    kit: 'thebes', label: 'the temple of Amun at Luxor', read: 'pylon, open court, second pylon, hypostyle hall and sanctuary on one axis',
    cites: ['egypt/luxor-pylon', 'egypt/hypostyle-hall', 'egypt/seated-colossus', 'egypt/obelisk'], size: [LUXOR.pylon[0], luxorDepth()], apron: LUXOR.front,
    lay: () => {
      const T = LUXOR, W = T.pylon[0], slots = [];
      let y = 0;
      const part = (asset, [across, len], extra = {}) => { const rect = { x: (W - across) / 2, y, w: across, d: len }; slots.push({ asset, rect, facing: 'n', ...extra }); y += len; return rect; };
      part('eg-pylon', T.pylon);
      const court = part('eg-court', T.court);
      const pylon2 = part('eg-pylon', T.pylon2);
      part('eg-hypostyle', T.hypostyle);
      y += T.gap;
      part('eg-sanctuary', T.sanctuary);
      const cx = W / 2;
      for (const o of [-1, 1]) {
        slots.push({ asset: 'eg-colossus', rect: { x: cx + o * 8.5 - 3, y: -10, w: 6, d: 9 }, facing: 'n' });
        slots.push({ asset: 'eg-obelisk', rect: { x: cx + o * 8.5 - 2, y: -19, w: 4, d: 4 }, facing: 'n' });
        slots.push({ asset: 'stele', rect: { x: cx + o * 7 - 1.1, y: pylon2.y - 4, w: 2.2, d: 2.8 }, facing: 'n' });
      }
      slots.push({ asset: 'eg-offering', rect: { x: cx - 2.5, y: court.y + court.d / 2 - 2.5, w: 5, d: 5 }, facing: 'n' });
      return { slots };
    },
    focus: (W, D) => [W / 2, D - LUXOR.sanctuary[1] / 2],   // the reliefs face the sanctuary
  },
  'khufu-pyramid': {
    kit: 'giza', label: 'the pyramid of Khufu', read: 'the great pyramid in its court, its mortuary temple against the east face',
    cites: ['giza/khufu-pyramid', 'giza/khufu-mortuary-temple'], size: [250, 290], apron: 12,
    lay: () => ({
      slots: [
        { asset: 'gz-mortuary-temple', rect: { x: 125 - 26, y: 0, w: 52, d: 40 }, facing: 'n' },
        { asset: 'gz-pyramid', rect: { x: 0, y: 40, w: 250, d: 250 }, facing: 'n', slope: 51.84, granite: 0, rough: false, court: 10, gap: 52, name: 'khufu', pyramidion: true },
      ],
    }),
  },
  'great-sphinx': {
    kit: 'giza', label: 'the Great Sphinx', read: 'the lion with a king\'s head, carved from the plateau\'s rock',
    cites: ['giza/great-sphinx'], size: [20, 73], apron: 10,
    lay: () => ({ slots: [{ asset: 'gz-sphinx', rect: { x: 0, y: 0, w: 20, d: 73 }, facing: 'n' }] }),
  },
  'athena-lindia': {
    kit: 'lindos', label: 'the temple of Athena Lindia', read: 'a small Doric temple at the cliff\'s edge, its altar before it',
    cites: ['lindos/athena-temple'], size: [7.75, 21.65], apron: 8,
    lay: () => ({ slots: [{ asset: 'ln-temple', rect: { x: 0, y: 0, w: 7.75, d: 21.65 }, facing: 'n' }, { asset: 'ln-altar', rect: { x: -1, y: -6, w: 7, d: 3 }, facing: 'n' }] }),
  },
  'palace-no-1': {
    kit: 'qin', label: 'Xianyang Palace No. 1', read: 'a hall on a two-tier rammed-earth terrace',
    cites: ['qin/xianyang-palace-1'], size: [60, 46], apron: 16,
    lay: () => ({ slots: [{ asset: 'qn-hall', rect: { x: 0, y: 0, w: 60, d: 46 }, facing: 'n' }] }),
  },
  capitolium: {
    kit: 'pompeii', label: 'the Capitolium', read: 'the temple of the Capitoline triad on its podium at the forum\'s head',
    cites: ['pompeii/capitolium'], size: [17, 37], apron: 6,
    lay: () => ({ slots: [{ asset: 'pp-temple', rect: { x: 0, y: 0, w: 17, d: 37 }, facing: 'n', podium: 3 }] }),
  },
  'temple-of-castor': {
    kit: 'forum', label: 'the temple of Castor', read: 'a Corinthian temple on a tall podium, its speakers\' platform before it',
    cites: ['forum/temple-castor'], size: [recDims('temple-castor').podium.w, recDims('temple-castor').podium.d], apron: 10,
    lay: (ctx) => {
      const CA = recDims('temple-castor'), P = ctx.palette;
      return { builds: [{ id: 'castor', rect: { x: 0, y: 0, w: CA.podium.w, d: CA.podium.d }, facing: 'n',
        build: (f) => podiumTemple(f, { ph: CA.podium.h, tribunal: CA.tribunal, order: 'corinthian', colD: CA.columns.D, colH: CA.columns.h, front: CA.columns.front, peripteral: true, flankN: CA.columns.flank, sideStairs: true, vaults: true, open: { cella: CA.cella, floor: 'tessellatum', inner: { D: 0.62, H: 6.2, n: 4, tint: P.giallo }, statues: P.bronze }, P }) }] };
    },
  },
  'curia-julia': {
    kit: 'forum', label: 'the Curia Julia', read: 'the senate\'s tall hall with a columned porch',
    cites: ['forum/curia-julia'], size: [recDims('curia-julia').w, recDims('curia-julia').d], apron: 4,
    lay: (ctx) => {
      const CU = recDims('curia-julia');
      return { builds: [{ id: 'curia', rect: { x: 0, y: 0, w: CU.w, d: CU.d }, facing: 'n', build: (f) => curia(f, { P: ctx.palette, h: CU.h }) }] };
    },
  },
  // Rothenburg c. 1500: the town hall on its market place, the parish church a street off it (sizes the general accounts')
  'rothenburg-rathaus': {
    kit: 'rothenburg', label: 'the Gothic town hall of Rothenburg', read: 'a long stone hall on the market place under a steep roof, its tall tower over it',
    cites: ['rothenburg/rathaus', 'rothenburg/ashlar', 'rothenburg/market-place'], size: [36, 16], apron: 0,
    lay: () => ({ slots: [
      { asset: 'rb-rathaus-hall', rect: { x: 0, y: 0, w: 36, d: 16 }, facing: 'n' },
      { asset: 'rb-rathaus-tower', rect: { x: 3, y: 4, w: 8, d: 8 }, facing: 'n' },
    ] }),
  },
  'st-jakob': {
    kit: 'rothenburg', label: 'St. Jakob', read: 'the Gothic parish church: a tall nave over aisles, its towers and pointed choir (the library\'s Gothic church)',
    cites: ['rothenburg/st-jakob', 'rothenburg/ashlar'], size: [24, 62], apron: 6,
    lay: () => ({ slots: [{ asset: 'st-jakob', rect: { x: 0, y: 0, w: 24, d: 62 }, facing: 'n' }] }),
  },
});
export const MONUMENT_IDS = Object.freeze(Object.keys(MONUMENTS));
