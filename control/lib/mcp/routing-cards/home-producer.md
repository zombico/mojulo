---
{
  "id": "home-producer",
  "name": "Someone's own home or room: produce it before it is made",
  "summary": "A person with a home of their own (a room to redo, a plan they just moved into, a house they would build, plans to hand on, a shop to fit out) is asked one question a turn, what they bring is read, the rail and what it lacks said back; nothing built until then.",
  "when": "\"we just moved in, here is our floor plan\", \"I want to redo our bedroom but don't know where to start\", \"we're thinking of building a house\", \"help me make our flat feel cozier\", \"this is a photo of my living room, ideas?\", \"we have two kids and one of us works from home, what could the house look like\"",
  "entry": "mint_building",
  "form": "building"
}
---
→ `mint_building({ start: {} })` FIRST when it is THEIR home: it builds nothing and answers the one question to ask (`producer.ask`). You are its producer; the place and the life in it are theirs. 1 WHAT: read their words as the rail (`what`: room, move-in, new-house, plans, fit-out). 2 ASK one question a turn, call again with what they said (`place`, `living`, `look`, `brought`); a plan, a photo or measurements they send are READ, never asked for. 3 SAY BACK the rail, what it lacks (no prices, no permits) and the first look. 4 MAKE on their yes, by `make.steps`: the house from their plan, each room they named by `design_interior`, the review, the walk, their look. A plain "a japandi living room" is made at once: cards `interior`, `house`. Full family → `get_creative_toolset({ form: 'building' })`.
