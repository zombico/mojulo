---
{
  "id": "exhibit-history",
  "name": "Visit a historic city at its period",
  "summary": "The history hall: real ancient towns, a general depiction of each period, drawn from a cited record, walkable, each with starters and an honest basis.",
  "when": "\"show me ancient Egypt\", \"walk through Thebes\", \"a Sumerian city with its ziggurat\", \"the pyramids of Giza when they were new\", \"a Greek town on Rhodes\", \"Qin Xianyang\", \"what did a Mesopotamian town look like\", \"an Egypt inspired level\", \"a day at a potter's yard on the Nile\"",
  "entry": "create_exhibit",
  "form": "exhibit"
}
---
→ Read the entry first: `get_exhibit({ id: 'history/<culture>' })` (list them: `get_exhibit({ hall: 'history' })`; a region's hub names its cultures). It gives the caption, the basis (attested, reconstructed, conjectural) and STARTERS. Make one, changed as asked: `create_exhibit({ id: 'history/<culture>', params: { scene?: 'city'|'region'|'slice', focus?, form?, view?, seed?, people? } })`. The town is solved from its culture's form and what its builders had at its year; `form` changes any part (streets, density, water, monument…), refused by name. The reply's `guideUrl` is its field guide: every choice, its knob, the record behind it. Iterate with `update_sketch`. Say the caption and that it is a general depiction with anachronisms to expect. An "inspired" level built in another kind is a derived work: caption it "inspired by …". (Invented town → `compose_world`.) Full family → `get_creative_toolset({ form: 'exhibit' })`.
