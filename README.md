"Chapayev game" (Russian: "игра в Чапаева") is a game played on a checkerboard, a
hybrid of checkers and billiards.

Game rules and funny details are present on [Wikipedia][chapayev]

The project has been started as a programming exercise while studying Javascript
and various JS libraries. In the same time I just wanted to play Chapayev with
friends, so I decided to implement multiplayer version as well.

JS libraries used so far:

* [Raphaёl][raphael] -- for game graphics and animation
* [Socket.io][] -- for client/server interaction suitable for any browser
* [Node.js][node] -- for server side
* [Knockout.js][ko] -- for structuring the code, introducing data model in UI
  using MVVM pattern
* [jQuery][] -- for querying the DOM, providing templates for Knockout.
* [Sylvester][] -- for vector/matrix operation needed for collision resolving.


[chapayev]:   http://en.wikipedia.org/wiki/Chapayev_%28game%29
[raphael]:    http://raphaeljs.com
[ko]:         http://knockoutjs.com
[socket.io]:  http://socket.io
[node]:       http://nodejs.org
[jquery]:     http://jquery.com
[sylvester]:  http://sylvester.jcoglan.com
