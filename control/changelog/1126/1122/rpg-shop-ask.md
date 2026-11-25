### A shop asked for while a talk is still up opens when it ends

The RPG page dropped a shop's opening when it was asked for on a frame a scene or a menu was still up, and never tried
again (`scene/channels/rpg-channel.js`). A priest's temple opens as their talk ends, and on a slow device the talk's end
can be logged a frame before the talk is down, so the temple stayed shut. The ask is now kept until the page is free.
In a shop or a battle already, it is answered as before, so a second press at the inn does not queue it again.
