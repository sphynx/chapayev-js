(function() {
     // to make global context more apparent
     var global = this;

     // constants
     var CELL_SIZE = 50, // board cell size
         ROWS = 8, // number of board rows and columns
         RADIUS = CELL_SIZE/2 - 5, // radius of a piece
         BOARD_SIZE = ROWS * CELL_SIZE, // board size
         PUSH_POWER = 1.3, // coefficient of "push-power"

         // network
         HOST = 'eth0.net.ua',
         PORT = 8124,

         // console commands
         TYPE_COMMAND = "cmd",
         CMD_NICK = "nick",
         CMD_INVITE = "invite",
         CMD_ACCEPT = "accept",
         CMD_DECLINE = "decline",
         CMD_RESET = "reset";

     // private utility functions which don't depend on state:

     // given start position and velocity vector,
     // calculates the position where a piece stops
     function getStopPoint(p, vx, vy) {
         var dx = vx / RADIUS * BOARD_SIZE * PUSH_POWER;
         var dy = vy / RADIUS * BOARD_SIZE * PUSH_POWER;
         return p.add($V([dx, dy]));
     }

     function getRatio(p0, pc, pf) {
         var intendedDistance = pf.distanceFrom(p0);
         var collisionDistance = pc.distanceFrom(p0);
         return collisionDistance / intendedDistance;
     }

     function mkEasingName(ratio) {
         return "custom" + ratio;
     }

     function isOutOfBoard(ball) {
         return ball.attr("cx") < CELL_SIZE
             || ball.attr("cx") > CELL_SIZE * (ROWS + 1)
             || ball.attr("cy") < CELL_SIZE
             || ball.attr("cy") > CELL_SIZE * (ROWS + 1);
     }

     function getBallSpeed(e, box) {
         var x, y, holder, f;

         // absolute location
         if (e.pageX && e.pageX != undefined && e.pageY && e.pageY != undefined) {
	         x = e.pageX;
	         y = e.pageY;
         } else {
	         x = e.clientX + document.body.scrollLeft +
                 document.documentElement.scrollLeft;
	         y = e.clientY + document.body.scrollTop +
                 document.documentElement.scrollTop;
         }

         // holder-relative location
         holder = document.getElementById("holder");
         x -= holder.offsetLeft;
         y -= holder.offsetTop;

         // (center of the box)-related location
         x -= (box.x + box.width / 2);
         y -= (box.y + box.height / 2);

         // invert, as a velocity vector points in the opposite direction
         return [-x, -y];
     }

     function parseCommand(commandStr) {
         var commandElements = commandStr.split(/\s+/);
         var message = null;
         if (commandElements.length > 0 && commandElements[0].charAt(0) === '/') {
             var commandName = commandElements[0].slice(1);
             switch (commandName) {
             case CMD_NICK:
                 if (commandElements[1] && commandElements[1].length > 0) {
                     var nick = commandElements[1];
                     message = { type: TYPE_COMMAND, name: CMD_NICK, arg: nick};
                 }
                 break;

             case CMD_INVITE:
                 if (commandElements[1] && commandElements[1].length > 0) {
                     message = { type: TYPE_COMMAND, name: CMD_INVITE, arg: commandElements[1] };
                 }
                 break;

             case CMD_ACCEPT:
                 if (commandElements[1] && commandElements[1].length > 0) {
                     message = { type: TYPE_COMMAND, name: CMD_ACCEPT, arg: commandElements[1] };
                 }
                 break;

             case CMD_DECLINE:
                 if (commandElements[1] && commandElements[1].length > 0) {
                     message = { type: TYPE_COMMAND, name: CMD_DECLINE, arg: commandElements[1] };
                 }
                 break;

             case CMD_RESET:
                 message = { type: TYPE_COMMAND, name: CMD_RESET};
                 break;
             }
         }

         return message;
     }

     // constructor, available in global namespace
     global.CH_Game = function() {
         // private instance variable
         var raphael, // Raphael object
             socket, // For connection to server

             input, // console input
             output, // console output

             movingBalls = {}, // for alternating moves implementation
             collisionResolver;

         // Knockout.js model object
         var model = {
             white: ko.observableArray([]),
             red: ko.observableArray([]),
             redRow: 1,
             whiteRow: ROWS,
             status: ko.observable("disconnected"),
             whiteNick: ko.observable("guest"),
             redNick: ko.observable("guest"),
             whiteMove: ko.observable(true),
             moveInProgress: ko.observable(false),
             multiplayer: ko.observable(false),

             changeMove: function() {
                 this.whiteMove(!this.whiteMove());
                 this.moveInProgress(false);
             },

             isAllowedToClick: function(team) {
                 return !this.moveInProgress() && this.currentMove() === team;
             },

             reset: function() {
                 this.white([]);
                 this.red([]);
                 this.whiteMove(true);
                 this.moveInProgress(false);
             },

             ballByName: function(name) {
                 for (var i = 0; i < this.all().length; i++) {
                     var b = this.all()[i];
                     if (b.name === name) {
                         return b;
                     }
                 }
                 return null;
             }
         };

         // dependent observable should be defined separately, alas.
         // see KO documentation for the gory details
         model.all = ko.dependentObservable(
             function() {
                 return this.white().concat(this.red());
             }, model);

         model.currentMove = ko.dependentObservable(
             function() {
                 return this.whiteMove() ? "white" : "red";
             }, model);

         // private functions:

         // start animation
         function startBall(ball, parentBall) {
             var p0 = $V([ball.attr("cx"), ball.attr("cy")]);
             var pf = getStopPoint(p0, ball.vx, ball.vy);
             var pcb = collisionResolver.nearest(p0, pf);

             movingBalls[ball.name] = true;
             model.moveInProgress(true);

             if (pcb) {
                 var pc = pcb.point;
                 var other = pcb.ball;
                 var ratio = getRatio(p0, pc, pf);
                 var timeRatio = 1 - Math.pow(1 - ratio, 1/3);

                 var easingId = mkEasingName(ratio);

                 Raphael.easing_formulas[easingId] = function(n) {
                     var f = Raphael.easing_formulas[">"];
                     return (1 / ratio) * f(timeRatio * n);
                 };

                 if (parentBall) {
                     ball.animateWith(parentBall, {cx: pc.e(1), cy: pc.e(2)}, 1000 * timeRatio, easingId,
                                      makeCollisionCallback(p0, pc, pf, ball, other, ratio));

                 } else {
                     ball.animate({cx: pc.e(1), cy: pc.e(2)}, 1000 * timeRatio, easingId,
                                  makeCollisionCallback(p0, pc, pf, ball, other, ratio));
                 }

             } else {
                 ball.animate({cx: pf.e(1), cy: pf.e(2)}, 1000, ">", makeStopCallback(ball));
             }
         }

         // callbacks called when animation is finished
         // we have two cases:
         // 1) collision callback: current ball collided into another one and we have
         //    to recalculate velocity vectors and start both balls again
         // 2) final callback: current ball stopped without any collision, so it
         //    should be checked whether it's out of the board and removed if so.

         // first case
         function makeStopCallback(ball) {
             return function() {
                 delete movingBalls[ball.name];
                 if (DS_utils.isEmpty(movingBalls)) {
                     model.changeMove();
                 }
                 if (isOutOfBoard(ball)) {
                     ball.animate(
                         {"opacity": 0}, 400, "linear",
                         function() {
                             if (ball.team === "red") {
                                 model.red.remove(ball);
                             } else {
                                 model.white.remove(ball);
                             }
                             ball.remove();
                         }
                     );
                 }
             };
         }

         // second case of callback described above
         function makeCollisionCallback(p0, pc, pf, ball, other, ratio) {
             return function() {
                 // resolve collision, that is
                 // find out velocity vectors of both balls after the collision
                 var v = $V([ball.vx, ball.vy]);
                 var q = $V([other.attr("cx"), other.attr("cy")]);
                 var resolved = collisionResolver.resolve(pc, v, q, ratio);

                 // remove easing function used in this animation
                 delete Raphael.easing_formulas[mkEasingName(ratio)];

                 // set new velocities
                 ball.vx = resolved.p.e(1);
                 ball.vy = resolved.p.e(2);
                 other.vx = resolved.q.e(1);
                 other.vy = resolved.q.e(2);

                 // start ball again
                 startBall(other);
                 startBall(ball, other);
             };
         };

         // UI stuff:
         function drawBoard() {
             var i, path = "";

             // 8x8 grid with path lines
             for (i = 1; i <= ROWS + 1; i++) {
                 path += "M" + (CELL_SIZE * i) + " " + CELL_SIZE + "v" + BOARD_SIZE;
                 path += "M" + CELL_SIZE + " "  + CELL_SIZE * i + "h" + BOARD_SIZE;
             }
             path += "z";
             raphael.path(path).attr("stroke-width", 1);

         }

         function resetPieces() {
             var i, piece, x, y;

             // clean all the pieces and reset model
             for (i = 0; i < model.all().length; i++) {
                 model.all()[i].remove();
             }
             model.reset();
             movingBalls = {};

             // setup new red and white pieces, push them into model
             for (i = 1; i <= ROWS; i++) {
                 x = CELL_SIZE * i + CELL_SIZE / 2;

                 // red piece
                 y = 1/2 * CELL_SIZE + (model.redRow * CELL_SIZE);
                 piece = raphael.circle(x, y, RADIUS).attr("stroke-width", 3);
                 piece.attr("fill", "red");
                 piece.team = "red";
                 piece.name = "r" + i;
                 piece.node.onclick = makeClickListener(piece);
                 model.red.push(piece);

                 // white piece
                 y = 1/2 * CELL_SIZE + (model.whiteRow * CELL_SIZE);
                 piece = raphael.circle(x, y, RADIUS).attr("stroke-width", 3);
                 piece.attr("fill", "white");
                 piece.team = "white";
                 piece.name = "w" + i;
                 piece.node.onclick = makeClickListener(piece);
                 model.white.push(piece);
             }

             collisionResolver = CH_CollisionResolver(model.all(), RADIUS);
         }

         function makeClickListener(ball) {
             return function(e) {
                 if (model.isAllowedToClick(ball.team)) {

                     // set ball velocity and start animation
                     var v = getBallSpeed(e, ball.getBBox());
                     ball.vx = v[0];
                     ball.vy = v[1];

                     if (model.multiplayer()) {
                         socket.send({ type: "move", piece: ball.name, vector: [ball.vx, ball.vy]});
                     }

                     startBall(ball);
                 }
             };
         }

         // init stuff
         function initUI() {
             raphael = Raphael("holder", 500, 500);

             input = $("#in");
             output = $("#out");

             input.focus();

             input.keypress(
                 function(event) {
                     if (event.which == '13') {
                         var dataStr = input.val();
                         output.append("\nclient: " + dataStr);
                         input.val("");

                         var message = parseCommand(dataStr);
                         if (message != null && message != undefined) {
                             // update nick on UI
                             switch (message.name) {
                             case CMD_NICK:
                                 model.whiteNick(message.arg);
                                 model.redNick(message.arg);
                                 break;

                             case CMD_RESET:
                                 resetPieces();
                                 return; // don't need to send to the server
                             }
                             socket.send(message);
                             output.append("\nclient: Sent object " + JSON.stringify(message));
                         } else {
                             output.append("\nclient: Syntax -- /&lt;command&gt; &lt;arguments&gt;");
                             output.append("\nclient: Commands available -- nick, invite, accept, decline, reset");
                         }
                     }
                 }
             );
         }

         function initSocket() {
             var handlers = {};

             handlers.connect = function() {
                 model.status("connected");
                 output.append('system: connected');
             };

             handlers.message = function(msg) {
                 output.append('\nserver: ' + JSON.stringify(msg));
                 switch (msg.type) {
                 case "gamestart":
                     resetPieces();
                     model.whiteNick(msg.player1);
                     model.redNick(msg.player2);
                     model.multiplayer(true);
                     break;

                 case "move":
                     var ball = model.ballByName(msg.piece);
                     if (ball) {
                         ball.vx = msg.vector[0];
                         ball.vy = msg.vector[1];
                         startBall(ball);
                     }
                     break;
                 }
             };

             handlers.disconnect = function() {
                 model.status("disconnected");
                 output.append('\nsystem: disconnected');
             };

             socket = CH_Socket(HOST, PORT, handlers);
             socket.connect();
         }

         function init() {
             initUI();
             initSocket();
             ko.applyBindings(model);
             drawBoard();
             resetPieces();
         }

         // public interface
         return {
             init: init
         };
     };

})();

// main entry point wrapped in jQuery $(...)
$(
    function() {
        CH_Game().init();
    }
);
