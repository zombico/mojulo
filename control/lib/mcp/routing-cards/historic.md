---
{
  "id": "historic",
  "name": "Visit a historic city at its period",
  "summary": "Encyclopedia entries: real ancient towns, a general depiction of each period, drawn from a cited record, walkable, each with starter manifests and an honest basis.",
  "when": "\"show me ancient Egypt\", \"walk through Thebes\", \"a Sumerian city with its ziggurat\", \"the pyramids of Giza when they were new\", \"a Greek town on Rhodes\", \"Qin Xianyang\", \"what did a Mesopotamian town look like\", \"an Egypt inspired level\", \"the Nile in flood\"",
  "entry": "create_sketch",
  "form": "world"
}
---
→ Read the entry first: `get_view_vocab({ id: '<entry>' })` (list them: `get_view_vocab({ family: 'entry' })`; a region such as `egypt` lists its entries in time order). The entry gives the caption (period, place, how it is drawn), its basis (what is attested, reconstructed, conjectural), its parts, and STARTERS. Mint a starter, changed as asked: `create_sketch({ title, manifest: { kind: 'historic', culture, scene, season?, view?, seed?, people? } })`; iterate with `update_sketch`. Say the caption when you hand it over, and that it is a general depiction of the period with anachronisms to expect; for "how do we know", read `<entry>/record`. An "inspired" level built in another kind after an entry's parts is a derived work: caption it "inspired by …", never as the place. (Contrast: an invented town → `compose_world`.) Full family → `get_creative_toolset({ form: 'world' })`.
