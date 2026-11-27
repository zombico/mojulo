### The flight sky: weathers in three dimensions, clouds to fly through, and a sea with waves

A pilot spends most of a flight looking at the sky. An airspace's `sky` is its weather, in the geocube's words (`clear`,
`fair`, `high`, `haze`, `overcast`, `storm`), or `{ kind, cover?, hour?, wind?, base?, seed? }`. Absent, it is fair at
mid afternoon. See `docs/flight-games.md`, "The sky a pilot flies in".

- **The weather** (`skyscape/sky.js`) is a set of layers at their heights:
  - cumulus in streets along the wind, a storm's cumulonimbus kilometres tall;
  - decks (stratus, stratocumulus, altocumulus) with their cover;
  - cirrus.
- **Its light**:
  - The sun stands at the hour and lights the ground. The terrain kernel's light and ramps follow its direction and
    tint, so a late sun warms the land.
  - An overcast's light is flat.
  - The haze is thicker in haze and storm, never thinner than the map planned.
  - The wind drifts the clouds and raises the sea (Pierson-Moskowitz).
- **The briefing**: `meta.sky` carries the kind, the hour, a METAR (`25012KT 5700 FEW036`) and the sea's height.
- **The page's sky and clouds** (`scene/channels/flight-sky.js`):
  - The sky is shaded as air, with a glow round the sun and its disc.
  - Cumulus are lit puff clusters with flat bases, sorted far to near, drifting and wrapping round the eye.
  - Decks have dark bellies. From above, the sky clears and the deck is a sunlit floor; a thunderhead's crown over its
    shelf is sunlit too.
  - Rain shafts hang under the towers.
  - Inside a cloud the eye sees whiteout.
  - The cumulus' shadows drift over the ground.
  - The weather is brought to the eye at each render, so a captured frame sees what a flown one does.
- **The sea** (`scene/channels/ocean.js`) replaces the flat translucent sheet on an airspace with sea:
  - a camera-centred sheet scaled by height;
  - the wind sea and a swell as Gerstner waves, faded under a pixel;
  - the aqua look's ripples, Fresnel sky and sun glint;
  - whitecaps in a fresh wind;
  - turquoise shallows and surf from the water's depth over the land.
- **Pilot School**'s lessons each have their own sky: a still morning, fair weather, an afternoon under altocumulus.
- `levels.<id>.airspace.sky` is a level setting; the flight card names it.
- A terrain page that is no airspace carries none of it.
