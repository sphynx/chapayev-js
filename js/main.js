var CH;

(function() {
     // to make global context more apparent
     var global = this;
     var enableLogging = false;

     var utils = DS_utils;
     var log = enableLogging ? utils.log : function(){};

     // constants
     var CELL_SIZE = 50, // board cell size
         ROWS = 8, // number of board rows and columns
         RADIUS = CELL_SIZE/2 - 5, // radius of a piece
         BOARD_SIZE = ROWS * CELL_SIZE, // board size
         PUSH_POWER = 1.3, // coefficient of "push-power"
         DEFAULT_NICK = "guest" + (Date.now() % 10000),
         NICK_COOKIE_NAME = "nick",

         // network
         HOST = "eth0.net.ua",
         //HOST = "localhost",
         PORT = 8124,

         // console commands and chat messages
         TYPE_COMMAND = "cmd",
         TYPE_CHAT_MSG = "chatmessage",
         TYPE_INIT = "init",

         CMD_NICK = "nick",
         CMD_INVITE = "invite",
         CMD_ACCEPT = "accept",
         CMD_DECLINE = "decline",
         CMD_REPLAY = "replay",
         CMD_RESET = "reset",
         CMD_CLEAR = "clear",
         CMD_DEBUG = "debug",
         CMD_LIST = "list";

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
         if (typeof e.pageX !== "undefined" && typeof e.pageY !== "undefined") {
             x = e.pageX;
             y = e.pageY;
         } else {
             x = e.clientX + document.body.scrollLeft +
                 document.documentElement.scrollLeft;
             y = e.clientY + document.body.scrollTop +
                 document.documentElement.scrollTop;
         }
         log("absolute location: {0}, {1}", x, y);

         // holder-relative location
         // NB: holder.clientLeft and clientTop shows border width
         // which is added to the element real width and height
         holder = document.getElementById("holder");
         x -= (holder.offsetLeft + holder.clientLeft);
         y -= (holder.offsetTop + holder.clientTop);
         log("holder-relative location: {0}, {1}", x, y);

         // (center of the box)-related location
         x -= (box.x + (box.width / 2));
         y -= (box.y + (box.height / 2));
         log("box: x = {0}, y = {1}, width = {2}, height = {3}", box.x, box.y, box.width, box.height);
         log("center of the box - relative location: {0}, {1}", x, y);

         // invert, as a velocity vector points in the opposite direction
         log("velocity vector: {0}, {1}", -x, -y);
         return [-x, -y];
     }

     function parseCommand(commandStr) {
         var commandElements = commandStr.split(/\s+/);
         var message = null;
         if (commandElements.length > 0) {
             if (commandElements[0].charAt(0) === '/') {
                 // it is a command as it starts with slash
                 var commandName = commandElements[0].slice(1);
                 switch (commandName) {
                 case CMD_NICK:
                 case CMD_INVITE:
                 case CMD_ACCEPT:
                 case CMD_DECLINE:
                     // 1-arg command
                     if (commandElements[1] && commandElements[1].length > 0) {
                         message = { type: TYPE_COMMAND, name: commandName, arg: commandElements[1] };
                     }
                     break;

                 case CMD_RESET:
                 case CMD_CLEAR:
                 case CMD_DEBUG:
                 case CMD_REPLAY:
                 case CMD_LIST:
                     // 0-args command
                     message = { type: TYPE_COMMAND, name: commandName };
                     break;

                 }
             } else {
                 // no slash -> chat message
                 message = { type: TYPE_CHAT_MSG, text: commandStr };
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
             whiteNick: ko.observable(utils.readCookie(NICK_COOKIE_NAME) || DEFAULT_NICK),
             redNick: ko.observable(utils.readCookie(NICK_COOKIE_NAME) || DEFAULT_NICK),
             whiteMove: ko.observable(true),
             moveInProgress: ko.observable(false),
             multiplayer: ko.observable(false),
             myColor: ko.observable("white"),
             whiteResult: ko.observable("-"),
             redResult: ko.observable("-"),
             lastOpponent: null,
             players: ko.observableArray([]),

             changeMove: function() {
                 this.whiteMove(!this.whiteMove());
                 this.moveInProgress(false);
             },

             isAllowedToClick: function(team) {
                 return !this.moveInProgress()
                     && this.currentMove() === team
                     && (!this.multiplayer() || this.myColor() === team);
             },

             reset: function() {
                 this.white([]);
                 this.red([]);
                 this.whiteMove(true);
                 this.moveInProgress(false);
                 this.whiteResult("-");
                 this.redResult("-");
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
             var cx = ball.attr("cx");
             var cy = ball.attr("cy");
             log("starting ball {0} located in ({1}, {2})", ball.name, cx, cy);
             var p0 = $V([cx, cy]);
             var pf = getStopPoint(p0, ball.vx, ball.vy);
             log("end point for {0} located in ({1}, {2})", ball.name, pf.e(1), pf.e(2));
             var pcb = collisionResolver.nearest(p0, pf);

             movingBalls[ball.name] = true;
             model.moveInProgress(true);

             if (pcb) {
                 var pc = pcb.point;
                 log("collision predicted for ball {0} in ({1}, {2})", ball.name, pc.e(1), pc.e(2));
                 var other = pcb.ball;
                 var ratio = getRatio(p0, pc, pf);
                 var timeRatio = 1 - Math.pow(1 - ratio, 1/3);

                 var easingId = mkEasingName(ratio);

                 Raphael.easing_formulas[easingId] = function(n) {
                     var f = Raphael.easing_formulas[">"];
                     return (1 / ratio) * f(timeRatio * n);
                 };

                 if (parentBall) {
                     log("animation synced with {0} started", parentBall.name);
                     ball.animateWith(parentBall, {cx: pc.e(1), cy: pc.e(2)}, 1000 * timeRatio, easingId,
                                      makeCollisionCallback(p0, pc, pf, ball, other, ratio));

                 } else {
                     log("non-synced animation started");
                     ball.animate({cx: pc.e(1), cy: pc.e(2)}, 1000 * timeRatio, easingId,
                                  makeCollisionCallback(p0, pc, pf, ball, other, ratio));
                 }

             } else {
                 log("no collisions for ball {0}, going straight to ({1}, {2})", ball.name, pf.e(1), pf.e(2));
                 ball.animate({cx: pf.e(1), cy: pf.e(2)}, 1000, ">", makeStopCallback(ball, pf));
             }
         }

         // callbacks called when animation is finished
         // we have two cases:
         // 1) collision callback: current ball collided into another one and we have
         //    to recalculate velocity vectors and start both balls again
         // 2) final callback: current ball stopped without any collision, so it
         //    should be checked whether it's out of the board and removed if so.

         // first case
         function makeStopCallback(ball, pf) {
             return function() {
                 log("ball {0} stopped at ({1}, {2})", ball.name, ball.attr("cx"), ball.attr("cy"));

                 /* commented as we have fixed Raphael and don't need to adjust anymore
                 log("adjusting to real stop point({0}, {1})", pf.e(1), pf.e(2));
                 ball.attr({cx: pf.e(1), cy: pf.e(2)});
                 log("adjusted: current ball position is ({0}, {1})", ball.attr("cx"), ball.attr("cy"));
                 */

                 delete movingBalls[ball.name];
                 if (DS_utils.isEmpty(movingBalls)) {
                     model.changeMove();
                 }
                 if (isOutOfBoard(ball)) {
                     log("hiding ball {0}", ball.name);
                     ball.animate(
                         {"opacity": 0}, 400, "linear",
                         function() {
                             if (ball.team === "red") {
                                 model.red.remove(ball);
                             } else {
                                 model.white.remove(ball);
                             }
                             checkResult();
                             ball.remove();
                         }
                     );
                 }
             };
         }

         // second case of callback described above
         function makeCollisionCallback(p0, pc, pf, ball, other, ratio) {
             return function() {
                 log("collision between {0} and {1}!", ball.name, other.name);

                 /* commented as we have fixed Raphael and don't need to adjust anymore
                 log("collision point for {0} is ({1}, {2})", ball.name, pc.e(1), pc.e(2));
                 ball.attr({cx: pc.e(1), cy: pc.e(2)});
                 log("adjusted: current ball position is ({0}, {1})", ball.attr("cx"), ball.attr("cy"));
                 */

                 // current velocity: multiplied on (1 - ratio) as we consider friction,
                 // therefore speed is constantly reducing all along the path
                 var v = $V([ball.vx * (1 - ratio), ball.vy * (1 - ratio)]);

                 log("velocity of {0} before collision is ({1}, {2})", ball.name, ball.vx, ball.vy);

                 var q = $V([other.attr("cx"), other.attr("cy")]);
                 log("position of {0} during collision is ({1}, {2})", other.name, q.e(1), q.e(2));
                 var resolved = collisionResolver.resolve(pc, v, q);

                 // remove easing function used in this animation
                 delete Raphael.easing_formulas[mkEasingName(ratio)];

                 // set new velocities
                 ball.vx = resolved.p.e(1);
                 ball.vy = resolved.p.e(2);
                 other.vx = resolved.q.e(1);
                 other.vy = resolved.q.e(2);

                 log("after collision. This ball {0}: vx = {1}, vy = {2}, other ball {3}: vx = {4}, vy = {5}",
                     ball.name, ball.vx, ball.vy, other.name, other.vx, other.vy);

                 // start ball again
                 startBall(other);
                 startBall(ball, other);
             };
         };

         // after any change in model.all() we check if the game has ended
         function checkResult() {
             var gameFinished = false;
             if (model.red().length === 0 && model.white().length > 0) {
                 model.redResult("lost");
                 model.whiteResult("won");
                 gameFinished = true;
             } else if (model.white().length === 0 && model.red().length > 0) {
                 model.whiteResult("lost");
                 model.redResult("won");
                 gameFinished = true;
             } else if (model.white().length === 0 && model.red().length === 0) {
                 model.redResult("draw");
                 model.whiteResult("draw");
                 gameFinished = true;
             }

             if (gameFinished) {
                 var result = model.myColor() == "red" ? model.redResult() : model.whiteResult();
                 socket.send({ type: "gameresult", result: result });
             }
         }

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
                 piece.attr("cursor", "crosshair");
                 piece.team = "red";
                 piece.name = "r" + i;
                 piece.node.onclick = makeClickListener(piece);
                 model.red.push(piece);

                 // white piece
                 y = 1/2 * CELL_SIZE + (model.whiteRow * CELL_SIZE);
                 piece = raphael.circle(x, y, RADIUS).attr("stroke-width", 3);

                 piece.attr("fill", "white");
                 piece.team = "white";
                 piece.attr("cursor", "crosshair");
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

                     log("mouse clicked: ball {0}, vx = {1}, vy = {2}", ball.name, ball.vx, ball.vy);

                     if (model.multiplayer()) {
                         socket.send({ type: "move", piece: ball.name, vector: [ball.vx, ball.vy]});
                     }

                     startBall(ball);
                 }
             };
         }

         function consoleAppend(str) {
             output.append("\n" + str);
             output.attr("scrollTop", output.attr("scrollHeight"));
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
                         consoleAppend("me: " + dataStr);
                         input.val("");

                         var message = parseCommand(dataStr);
                         if (message) {
                             switch (message.name) {
                             case CMD_NICK:
                                 // update nick on UI
                                 model.whiteNick(message.arg);
                                 model.redNick(message.arg);
                                 // set cookies
                                 utils.createCookie("nick", message.arg, 14);
                                 break;

                             case CMD_REPLAY:
                                 if (!model.lastOpponent) return;
                                 message.name = CMD_INVITE;
                                 message.arg = model.lastOpponent;
                                 break;

                             case CMD_RESET:
                                 resetPieces();
                                 return; // don't need to send to the server

                             case CMD_CLEAR:
                                 output.html("");
                                 return; // don't need to send to the server
                             }

                             socket.send(message);
                             log("client: Sent object {0}", JSON.stringify(message));
                         } else {
                             consoleAppend("help: Syntax -- /&lt;command&gt; &lt;arguments&gt;");
                             consoleAppend("help: Commands available -- nick, invite, accept, decline, replay, clear");
                             consoleAppend("help: Or just type something to chat");
                         }
                     }
                 }
             );
         }

         function initPlayerOnServer() {
            var nick = model.whiteNick();
            socket.send({ type: TYPE_INIT, nick: nick });
         }

         function initSocket() {
             var handlers = {};

             handlers.connect = function() {
                 model.status("connected");
                 consoleAppend("system: connected");
                 initPlayerOnServer();
             };

             handlers.message = function(msg) {
                 switch (msg.type) {
                 case "gamestart":
                     resetPieces();
                     if (msg.color == "white") {
                         if (model.myColor() === "red") {
                             model.whiteNick(model.redNick());
                         }
                         model.redNick(msg.opponent);
                     } else {
                         if (model.myColor() === "white") {
                             model.redNick(model.whiteNick());
                         }
                         model.whiteNick(msg.opponent);
                     }
                     model.myColor(msg.color);
                     model.multiplayer(true);
                     model.lastOpponent = msg.opponent;
                     consoleAppend("* new game has started!");
                     break;

                 case "move":
                     log("got move message for {0}", msg.piece);
                     var ball = model.ballByName(msg.piece);
                     if (ball) {
                         ball.vx = msg.vector[0];
                         ball.vy = msg.vector[1];
                         startBall(ball);
                     }
                     break;

                 case "chatmessage":
                     consoleAppend("{0}: {1}".format(msg.from, msg.text));
                     break;

                 case "nickchange":
                     consoleAppend("* {0} is known as {1}".format(msg.oldNick, msg.newNick));
                     model.players.remove(function(p) { return p.name === msg.oldNick; });
                     model.players.push({ name: msg.newNick });
                     break;

                 case "nickack":
                     if (model.whiteNick() === msg.nick) {
                         consoleAppend("system: your nick is {0}".format(msg.nick));
                     } else {
                         consoleAppend("system: your nick is taken, so it has been changed to {0}".format(msg.nick));
                         model.whiteNick(msg.nick);
                         model.redNick(msg.nick);
                     }

                     if (msg.oldNick) {
                         model.players.remove(function(p) { return p.name === msg.oldNick; });
                         model.players.push({ name: msg.nick });
                     }

                     break;

                 case "gamerequest":
                     consoleAppend("* {0} wants to play with you! Please type /accept {1} or /decline {2}".format(
                                       msg.from, msg.from, msg.from));
                     var res = confirm("{0} wants to play with you! Do you want to accept?".format(msg.from));
                     socket.send({type: "cmd", name: res ? "accept" : "decline", arg: msg.from});
                     break;

                 case "decline":
                     consoleAppend("* {0} has declined your invitation :(".format(msg.from));
                     break;

                 case "playerslist":
                     var players = msg.list;
                     var names = [];

                     model.players([]);
                     for (key in players) {
                         names.push(players[key].nick);
                         model.players.push({ name: players[key].nick });
                     }

                     consoleAppend("players online: {0}".format(names.join(", ")));
                     break;

                 case "left":
                     consoleAppend("* {0} has left :(".format(msg.who));
                     model.players.remove(function(p) { return p.name === msg.who; });
                     break;

                 case "new":
                     model.players.push({ name: msg.who });
                     consoleAppend("* new player arrived: {0}".format(msg.who));
                     break;

                 case "error":
                     consoleAppend("error: {0}".format(msg.text));
                     break;

                 case "gamefinished":
                     var txt = (msg.result === "draw") ? "it is draw" : ("you " + msg.result);
                     consoleAppend("server: the game has finished, {0}".format(txt));
                     break;

                 default:
                     consoleAppend("raw message from server: " + JSON.stringify(msg));
                 }
             };

             handlers.disconnect = function() {
                 model.status("disconnected");
                 consoleAppend("system: disconnected");
                 socket.connect();
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
             init: init,
             invite: function(name) {
                 consoleAppend("inviting {0}...".format(name));
                 socket.send({ type: TYPE_COMMAND, name: CMD_INVITE, arg: name });
             }
         };
     };

})();


// main entry point wrapped in jQuery $(...)
$(
    function() {
        CH = CH_Game();
        CH.init();
    }
);
