---
{
  "id": "historic",
  "name": "Visit a historic city at its period",
  "summary": "Encyclopedia entries: real ancient towns, a general depiction of each period, drawn from a cited record, walkable, each with starter manifests and an honest basis.",
  "when": "\"show me ancient Egypt\", \"walk through Thebes\", \"a Sumerian city with its ziggurat\", \"the pyramids of Giza when they were new\", \"a Greek town on Rhodes\", \"Qin Xianyang\", \"what did a Mesopotamian town look like\", \"an Egypt inspired level\", \"a day at a potter's yard on the Nile\"",
  "entry": "create_sketch",
  "form": "world"
}
---
→ Read the entry first: `get_view_vocab({ id: '<entry>' })` (list them: `get_view_vocab({ family: 'entry' })`). It gives the caption, the basis (attested, reconstructed, conjectural) and STARTERS. Mint one, changed as asked: `create_sketch({ title, manifest: { kind: 'historic', culture, scene?: 'city'|'region'|'slice', focus?, form?, view?, seed?, people? } })`. The town is solved from its culture's form and what its builders had at its year; `form` changes any part (streets, density, water, monument…), refused by name. The reply's `guideUrl` is its field guide: every choice, its knob, the record behind it. Iterate with `update_sketch`. Say the caption and that it is a general depiction with anachronisms to expect. An "inspired" level built in another kind is a derived work: caption it "inspired by …". (Invented town → `compose_world`.) Full family → `get_creative_toolset({ form: 'world' })`.
