/**
 * historic/ledger/records — every cited record, one line each, with the region it was written for. A culture card
 * names its record from here (`record: RECORDS.egypt`), so a record has one home and two cards reading it share it
 * by identity (./depth.js counts that). The ledger (./index.js) reads them all as one table. Format and checks:
 * ../record.js.
 */
import { SUMER_RECORD, SUMER_SOURCES } from '../record/sumer.js';
import { SUMER_FARM_RECORD } from '../record/sumer-farm.js';
import { SUMER_WORKS_RECORD } from '../record/sumer-works.js';
import { EGYPT_RECORD, EGYPT_SOURCES } from '../record/egypt.js';
import { EGYPT_INDUSTRY_RECORD } from '../record/egypt-industry.js';
import { GIZA_RECORD, GIZA_SOURCES } from '../record/giza.js';
import { LINDOS_RECORD, LINDOS_SOURCES } from '../record/lindos.js';
import { QIN_RECORD, QIN_SOURCES } from '../record/qin.js';
import { POMPEII_RECORD, POMPEII_SOURCES } from '../record/pompeii.js';
import { FORUM_RECORD, FORUM_SOURCES } from '../record/forum.js';

const rec = (id, region, entries, sources) => Object.freeze({ id, region, entries, sources });

export const RECORDS = Object.freeze({
  sumer: rec('sumer', 'mesopotamia', [...SUMER_RECORD, ...SUMER_FARM_RECORD, ...SUMER_WORKS_RECORD], SUMER_SOURCES),
  giza: rec('giza', 'egypt', GIZA_RECORD, GIZA_SOURCES),
  egypt: rec('egypt', 'egypt', [...EGYPT_RECORD, ...EGYPT_INDUSTRY_RECORD], EGYPT_SOURCES),
  lindos: rec('lindos', 'greece', LINDOS_RECORD, LINDOS_SOURCES),
  qin: rec('qin', 'china', QIN_RECORD, QIN_SOURCES),
  pompeii: rec('pompeii', 'italy', POMPEII_RECORD, POMPEII_SOURCES),
  forum: rec('forum', 'italy', FORUM_RECORD, FORUM_SOURCES),
});
