/**
 * The town layouts, one line each: a culture card names one by id (`layout`), and `planHistoricCity` calls it as
 * `plan({ ...opts, culture }, card)`. A layout reads the card it is given (palette, skins, assets, site), so any
 * number of cultures can share one: a culture spread from another (`polis` from Lindos) is laid out by its layout
 * in its own colours. Sumer's ring canal ('ring-canal', the default) lives in ../historic-city.js.
 */
import { planRiverAxis } from './thebes.js';
import { planPlateau } from './giza.js';
import { planAcropolis } from './lindos.js';
import { planWeiWards } from './qin.js';
import { planLavaSpur } from './pompeii.js';
import { planForum } from './forum.js';

export const LAYOUTS = {
  'river-axis': planRiverAxis,   // a river along the town, a temple on an axis from its quay (New Kingdom Thebes)
  plateau: planPlateau,          // a necropolis plateau over a valley town (Giza)
  acropolis: planAcropolis,      // a sanctuary on a rock over a terraced town (Lindos, the polis)
  'wei-wards': planWeiWards,     // walled wards on an axis from a palace to a river (Qin Xianyang)
  'lava-spur': planLavaSpur,     // a forum town on a lava spur (Pompeii)
  forum: planForum,              // one civic space at measured positions (the Forum Romanum)
};
