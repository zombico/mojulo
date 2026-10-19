// The OOZE shelf: one row per ooze (oozes/<id>.js exporting `ooze`). A new ooze is a row first; code only when a row
// needs a layer or a site kind that does not exist.
import { ooze as dire } from './dire.js';

const row = (o) => Object.freeze({ ...o, ...(o.form ? { form: Object.freeze({ ...o.form }) } : {}) });

export const OOZES = Object.freeze(Object.fromEntries([dire].map((o) => [o.id, row(o)])));
