### Natural knockback: an impact's energy split between the ground and what stands near it

- **Knockback is its own channel, apart from damage.** A blow carries energy as well as hp:
  - a direct hit's **kinetic** energy pushes what it strikes along the blow;
  - an **impact** where it meets the ground spreads as a shock. The ground takes its share, and each body near takes its
    share by how much of the shock it fills, falling off with distance.
- **What holds, and what flies.** A body holds by its footing (friction on its mass over a short slip; none in the air).
  Past that it is thrown, an arc and then a slide friction stops, held to the play cap. Light things fly, heavy things
  only stagger; a hard throw knocks down, and a wall stops it with a stagger. A body's mass is its `body.mass`, or its
  hitbox's size (a person about 75 kg).
- **Splash damage by proximity.** In a level with knockback, a burst's damage and poise fall off with distance from it
  (`splash: 'flat'` keeps the old way).
- **Magic attacks with kinetic and impact settings:** a weapon's `knock`, a strike's `strikeKnock`, a power's `kinetic`
  and `impact` (its beam pushes its target and releases its impact where it lands).
- **Natural:** a level's `knockback` (true, or `{ scale, hero, cap, splash, min, slam, natural }`) gives every burst an
  impact from its size and makes a hard landing a slam. The hero is thrown too, unless `hero: false`.
- **The juice is vayo's:** the impact's air on the fires near it, a dust ring where it lands, dust under what slides.
- A level without knockback, and attacks without kinetic or impact, change no behaviour.
