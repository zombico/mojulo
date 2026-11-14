### The animation studio: a scene written as a screenplay, filmed in Blender, from the agent

In progress. The first step of a sibling studio to the game studio, whose outcome is a directed film rather than a
game.

- **Ask for a short film of your characters.** Write a scene as a screenplay (who says what, a feeling in brackets,
  who crosses to where, who turns to whom, a pause) and name who plays each part. Your agent now hands it to the
  cinematics department directly. Before, that took a command run by hand. The characters act it (their faces and
  bodies on the words, listening and nodding while the other speaks). It is shot the way a director would shoot it.
  It comes back as a Blender film: each actor with its performance, the cameras cut together, and a film look
  (Cycles) or an anime look (EEVEE), ready to render to video in one command.
- **Cast a persona and it plays itself.** A persona you made is the actor: its character, its way of speaking, its
  acting style and its role come with it. Anything the scene says for that part wins.
- **The director's notes come back with the film**, such as a shot held too long or a speaker turned away from whom
  they're talking to. Each comes with a change to the script that answers it. They never stop the film.
- **See the film before it is made: a storyboard.** Ask for a scene and the first thing back is its storyboard, in
  seconds, with nothing rendered. There is a panel for each shot the director would take, drawn as a sketch with
  stand-in figures where the actors stand and seen from that shot's camera. Beside each panel is a plan of the room
  from above, showing where everyone stands, the path they walk and where the camera is. Under it are the shot's name,
  how long it holds, its lens, whether the camera moves, the lines spoken in it and any director's note about it. Look
  through the cut there before the film is made: the film is made from the same plan, so what you approve is what you
  get.
- **An animatic.** Ask for a video and the storyboard is played as one: each panel held for as long as its shot lasts,
  with the line being spoken shown under it. Several scenes' animatics can be stitched into one cut.
- **Your recordings set the scene.** Give the scene a recording of any line, from the voice worker or from a person.
  - That line now lasts exactly as long as the recording.
  - The character's face, gestures and mouth are fitted to the recording, and whoever is listening nods on its
    stressed words.
  - The storyboard's animatic plays the recordings with captions. The Blender film carries the voice and plays it
    under the render.
  - A recording that was made for different words than its line is pointed out.
- **Dubbed versions.** Give the same scene in other languages, one recording per line. The picture stays exactly the
  same and only the mouths change to match the new language.
  - The animatic carries each language as its own audio track and subtitles.
  - The Blender film switches between languages with one command.
  - A dubbed line that runs into the next one is pointed out, with how far over it goes.
- **A set.** Put a scene in a world you made (a room, a hall, a trail, a level).
  - Its rooms and doorways become places the script can send the actors to.
  - Anyone not placed stands in the biggest room.
  - The world comes into the Blender film under the actors.
  - A shot whose camera would be behind a wall is pointed out.
- **A whole short film: the animation studio.** Write a film as a set of scenes that share one cast, with the places
  they are set, one look and the order they play in. It is kept as one piece of work, and its page is the film's book.
  - **Departments.** It is made the way a studio makes one, in departments: the script, casting, the sets,
    performance, the camera, voice and dubbing, the look, the edit and the render. Each says how its part stands and
    gives its own advice, such as a part nobody plays, a wall in a shot, or a scene where nobody looks at whom they
    talk to. The film also says what to do next.
  - **Boards and approval.** Board every scene in seconds, then look at the boards and approve them one scene at a
    time. Change a scene afterwards and its approval is marked as out of date.
  - **The animatic.** Cut every scene into one animatic, with the voices and each dubbed language as their own tracks
    and subtitles.
  - **Blender.** Send the whole film to Blender, scene by scene. A long film is made over several calls, each picking
    up where the last stopped, and a single script joins the rendered scenes into one cut with their sound.
- **Rendering the film in Blender.** A single command renders a scene, or the whole film, in Blender on your machine.
  - **Stop and go on.** It works through the film a short piece at a time and can stop whenever you like. Run it again
    and it carries on from where it stopped, never redrawing a frame it already has.
  - **The finished film.** It finishes each scene with its voice, then joins the scenes into the finished film.
  - **Progress.** The film's book shows how far each scene has got.
  - **Change a scene and only that scene is rendered again.** Edit a scene after it was rendered and the next run
    renders that scene afresh, keeps the others and joins the film again. Before, the old render was taken for the
    new scene.
- **A bare stage for a scene with no set.** A scene that is not set in one of your worlds now plays on a plain stage:
  a floor, a soft sky and a light. Before, the film opened on Blender's own starting cube, with the actors standing
  inside it, and each actor brought a second floor and spare cameras of its own.
- **A set is lit as you made it.** A scene set in one of your worlds now takes that world's light into Blender: its
  sky, its sun, or indoors its lamps at their strength. Before, a room came in dark, its torches barely glowing.
- **Each language has its own picture.** A dubbed version is now drawn on its own, so going from one language to
  another, or back to the original, always shows the right mouths. Before, a dubbed render kept the original's mouths
  under the new voice, and the frames of whichever language was rendered first were used again for the next. A scene
  with no dub in a language plays its own voice in that language's cut.
- **Film a scene in a room you decorated.** A room fitted out by the interior designer can now be a film's set.
  Before, a scene set in one was refused: the room named nowhere to stand.
  - **Places a script can name.** Each piece of furniture, the fireplace, the door and each window is a place:
    "Ada crosses to the fireplace.", "Jon crosses to the door.", "to the sofa". The place is the clear floor nearest
    the piece's front, so nobody is stood inside a table.
  - **Where the cast stands.** With no marks of their own, the cast stands on the room's open floor with the most room
    left for a camera, not in the room's middle where the coffee table is.
  - **The camera stays in the room.** A real room has four walls, so each camera stands inside them on a wider lens,
    and stops in front of a bookcase or a chimney breast rather than in or behind it. Before, a wide shot stood
    outside the wall and saw only its back.
  - **Walking round the furniture.** A cross goes round the sofa, the table and the other actors by the shortest
    clear way, turning at each corner. Before, it was a straight line through whatever stood between.
  - **The storyboard shows the room.** Each panel now draws the room's walls and furniture as plain blocks round the
    stand-in figures, seen from that shot's camera, with each door and window as an opening in its wall. The plan
    from above shows each piece of furniture, the doors and windows, and the way a walk goes round the furniture.
    Before, the panels showed the figures on empty ground, so a shot blocked by a sofa could only be seen by
    rendering it in Blender.
  - **House lights.** A room with no lamps of its own is lit by a soft light under its ceiling. Before, it rendered
    black.
- **A scene anywhere, with anything in it.** A scene can now be set in anything mojulo made, and anything mojulo made
  can stand in it. Neither has to be prepared for filming.
  - **Any world is a set.** A city, a landscape, a house, a level, or a single object such as a table or a vehicle.
    Before, only worlds that named places to stand could be a set, and the rest were refused. A world with no named
    places puts the cast on the clear ground nearest its middle.
  - **Things in the way are respected everywhere.** Whatever the set is, a walk goes round what stands in it, and
    each camera is moved to where it can see the actors. Before, this worked only in a decorated room.
  - **Props.** Name any object and where it stands, and it is in the scene: "Ada crosses to the car." sends her to
    it, walks go round it and the cameras see past it. A scene needs no set to have props.
  - **The storyboard draws it all.** Buildings, furniture and props are drawn as plain blocks round the stand-in
    figures, in each panel and in the plan from above.
  - **Props are in the Blender film.** Each prop comes into the film as itself (the car is a car, not a block),
    standing where the storyboard drew it and at the same size. Before, a prop was in the plan and the storyboard
    only.
  - **Dress a scene by naming things.** Say "a sedan", "a city bus", "a motorcycle", "a chesterfield", "a crate" or
    "a barrel" and where it stands, and it is in the scene at its real size. Nothing has to be made first: the
    vehicles, the furniture and the props mojulo already has are all there to be named. Before, every prop had to
    be an object you had made, and a vehicle needed its scale given. A word mojulo has nothing for is refused, with
    what it does have.
  - **A thing can arrive, and leave.** Say where a prop comes from and it drives or moves in to its place during
    the scene: a car that pulls up at the kerb. Say where it goes and it drives off. Say both and it pulls up,
    waits, and goes. Time it by the script ("as line 2 starts", "when line 4 ends") or in seconds. It faces the way
    it came, and stays on the ground along its way. In the storyboard it is drawn where it stops.
  - **It can follow a route.** Give a moving thing the points of its way and it goes through them in turn, facing
    the way it is going and turning into each corner: a car that comes along one street and turns into the next.
  - **Not yet:** a house does not name its rooms, so its cast stands outside it. A moving thing's route is the one
    you give it: it is not found for it, and it is not kept clear of the cast.
- **Film outdoors: hills, fields and streets.** A scene can be set on land that rises and falls, and in a town.
  - **The cast stands on the ground.** On a hillside each actor, camera and prop stands at the height of the ground
    under it, and a walk keeps its feet on the land. Before, everyone stood at one height, so on a slope they floated
    or sank.
  - **A hill is not a wall.** Rising land is no longer treated as something in the way. Before, a storyboard on a
    field drew the land as stacked slabs round the cast.
  - **A house is a place to stand in front of.** Send the cast to a town's house and they stand before its front
    door. Before, they were stood inside it and the first shot was a blank wall.
  - **Nobody is stood inside a thing.** A place a scene uses that is inside a rock or a building is moved to the
    clear ground beside it.
  - **The storyboard shows the slope.** The land is drawn as low steps the cast stands on, so someone up the hill
    is drawn up the hill. Before, the storyboard drew the ground level and a slope showed only in Blender.
  - **A hill between the camera and the cast is pointed out,** with where it rises and by how much.
  - **More places to send the cast.** A landscape, a town or a city now has a `start` (where its walk begins). A
    town also has its streets and the crossing where two meet. A city has the street corners nearest its centre.
    Before, a city named nowhere and its cast was stood near the middle of the map.
  - **A walk follows the path.** Send someone from one place on a trail or a sidewalk to another and they go along
    it. Before, they walked a straight line across country.
  - **Street trees and parked cars are part of the set.** The cast walks round a tree's trunk and a parked car,
    the camera avoids them, and the storyboard draws them. Before, anything a town or city placed by repeating one
    model was invisible to the scene and the cast walked through it.
  - **Faster on big places.** Only the part of the world near the scene is read, and a film whose scenes share a
    place reads it once. A city still takes about a minute the first time.
  - **Not yet:** a town's park, school yard and lot, and a city's waterfront and squares, are not places.
- **The written build steps keep the cast.** The steps a scene's Blender folder gives for building it by hand now
  save the actors into the film. Before, followed as written, they left the film with its set and cameras and no
  actors (rendering with the one command was not affected).
- **Say where a scene is, in words.** A film's set no longer has to be a world you made first. Say "a grassy field
  by a lake at dusk" and the film makes that place and plays the scene there. Or name a style of town or city and
  it makes the street.
  - **Made once, and kept.** The same words give the same place every time. Edit the film and the place stays as
    it is. Change the words and the place changes with them.
  - **It says what it understood.** The film lists which of your words shaped the place and points out any it
    could not use, such as a thing or a person, which belong in the scene's props.
  - **An ordered cutscene can ask the same way,** so whoever orders it need not hand over a world for every place.
- **Shoot a place at any hour.** Give a scene its hour (dawn, noon, dusk, night, or a time) and the Blender film is
  lit for it, whatever time of day the place was made at. One street can be a noon scene and a night scene in the
  same film, with no second copy of the street. Before, a scene could only be lit as its place was made.
  - **Street trees and parked cars take the light.** In a world sent to Blender, anything placed by repeating one
    model (a street's trees, its parked cars) is now lit like the rest of the place, and casts its shadow. Before,
    those kept their own flat colour whatever the light, so at night they glowed white against a dark street.
  - **Not yet:** street lamps that a place lights only at night.
- **The film suggests where a scene should be.** A scene with no place plays on a bare stage. When its words name
  one, the film now suggests it, ready to accept: a street of houses for "outside her house", a city for "a street
  corner downtown", a landscape in the scene's own words for "a field by a lake", and the time of day it mentions.
  For an ordered cutscene it reads the notes on each event, so an order can arrive with no places at all.
- **Ask for a room.** A film's place can be a living room, a bedroom, a dining room, a study or an entry, in a
  named style, with no room made first. The film has it designed and furnished, and the scene can send the cast to
  its sofa, its bookcase or its door. Ask for another style and the same room is redecorated. A scene set
  "in the study" or "inside" is offered a room the same way an outdoor scene is offered a street.
- **Choose how a street is built.** A place asked for as a town or city can name its building style (a Tudor market
  town, art deco, brutalist, a brick streetcar suburb and others) and how its streets are laid.
- **Weather.** Give a scene its weather and the Blender film is shot in it: clear, haze, mist, fog, dust, overcast,
  drizzle, rain, a downpour, a thunderstorm, snow, a blizzard or a dust storm.
  - **Cloud dims and softens the light.** Under an overcast or stormy sky the sun barely gets through, shadows go
    soft and the sky is grey.
  - **Mist and fog fade what is far.**
  - **Rain and snow fall** round the cast for the whole scene.
  - It combines with the scene's hour: the same street can be a bright noon, a foggy morning and a rainy dusk.
  - **Not yet:** rain falls through a porch roof or a ceiling; the ground does not get wet and snow does not
    settle; no lightning, and the trees do not move in the wind.
- **Order a cutscene.** Another part of mojulo (the game studio, for one) can order a cutscene from the animation
  studio by handing over what it already has: its characters, its places (a landscape, a street, a level, a room) and
  notes on what happens in each event.
  - **The order becomes a film.** The characters are the cast, each place is a set, and each event is a scene, in the
    order given. The film's book opens with the order: who asked, what for, and each event's notes.
  - **Notes are enough to start.** An event given as notes with no dialogue is marked as not written yet, with the
    notes beside it, until its scene is written. An event that came with its dialogue plays it as given.
  - **It says how far the order has got:** each event as not written, written, storyboarded, approved, cut into the
    video, or rendered, and which events are still to go.
  - **The cutscene is handed back** to whoever ordered it: the video, the film and each event's storyboard. Handed
    back early, it says what is still missing. Changed afterwards, it says the hand-back is out of date.
  - **Whoever ordered can ask what it ordered** and gets every cutscene with its progress.
  - **The game plays it.** A game can name the returned film as its opening, its prologue, its ending or any
    cutscene in its flow. The video plays over the game and can be skipped. The game points at the film, so when
    the cutscene is made again the game plays the new one, and an exported game carries the video with it. A film
    with no video yet is passed over, and the export says which.
  - **Not yet:** the game studio fills the order in by hand (naming a story moment does not fill it in), and a
    cutscene cannot yet take the place of a story moment by its name.
- **Walk up to someone.** A script can send a character to another character ("Ada crosses to Jon."), not only to a
  place. They walk up and stop at a conversation's distance.
- **Lighting each shot like a film crew.** Ask for it and every shot gets its own lights, placed from where that
  shot's camera stands and which way the actor faces: the main light on the far side of the face, a softer fill
  across from it, and a rim light from behind that lifts the figure off the background. The lights change on each cut,
  as a crew relights each setup.
- **Focus and motion blur.** The camera can focus on whoever it is looking at, with the background softly out of
  focus, and fast movement can blur as it would through a real lens.
