var cs = 50; // cell size
var rows = 8; // number of rows and columns
var cr = cs/2 - 5; // radius of circle
var bs = rows * cs; // board size
var k = 1.3; // coefficient of "push-power"

var HOST = 'eth0.net.ua';
var PORT = 8124;

var R; // Raphael object
var socket; // For connection to server

var input; // console input
var output; // console output

var movingBalls = {}; // for alternating moves implementation
var collisionResolver;

// commands
var TYPE_COMMAND = "cmd";
var CMD_NICK = "nick";
var CMD_INVITE = "invite";
var CMD_ACCEPT = "accept";
var CMD_DECLINE = "decline";

// KO model
var model = {
    white: ko.observableArray([]),
    red: ko.observableArray([]),
    redRow: 1,
    whiteRow: rows,
    status: ko.observable("disconnected"),
    nick: ko.observable("set with /nick cmd"),
    whiteMove: ko.observable(true),
    moveInProgress: ko.observable(false)
};

model.all = ko.dependentObservable(
    function() {
        return this.white().concat(this.red());
    }, model);

model.currentMove = ko.dependentObservable(
    function() {
        return this.whiteMove() ? "white" : "red";
    }, model);

function changeMove() {
    // flip move
    model.whiteMove(!model.whiteMove());
    model.moveInProgress(false);
}

function isAllowedToClick(team) {
    return !model.moveInProgress() && model.currentMove() === team;
}

function isEmpty(obj){
    for (var i in obj) { return false; }
    return true;
}

// given start position and velocity vector,
// calculates the position where ball will stop
function getStopPoint(p, vx, vy) {
    var dx = vx / cr * bs * k;
    var dy = vy / cr * bs * k;
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
        ball.animate({cx: pf.e(1), cy: pf.e(2)}, 1000, ">", makeFinalCallback(ball));
    }
}

function makeFinalCallback(ball) {
    return function() {
        delete movingBalls[ball.name];
        if (isEmpty(movingBalls)) {
            changeMove();
        }
        if (isOutBoard(ball)) {
            ball.animate({"opacity": 0}, 400, "linear",
                         function() {
                             if (ball.team === "red") {
                                 model.red.remove(ball);
                             } else {
                                 model.white.remove(ball);
                             }
                             ball.remove();
                         });
        }
    };
}

function isOutBoard(ball) {
    return ball.attr("cx") < cs
        || ball.attr("cx") > cs * (rows + 1)
        || ball.attr("cy") < cs
        || ball.attr("cy") > cs * (rows + 1);
}

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

    // invert, as velocity vector points in the opposite direction
    return [-x, -y];
}

function makeClickListener(ball) {
    return function(e) {

        if (isAllowedToClick(ball.team)) {

            // set ball velocity and start animation
            var v = getBallSpeed(e, ball.getBBox());
            ball.vx = v[0];
            ball.vy = v[1];

            startBall(ball);
        }
    };
}

function drawBoard() {

    var i, x, c;
    var p = "";

    // 8x8 grid with path lines
    for (i = 1; i <= rows + 1; i++) {
        p += "M" + (cs * i) + " " + cs + "v" + bs;
        p += "M" + cs + " "  + cs * i + "h" + bs;
    }
    p += "z";
    R.path(p).attr("stroke-width", 1);

    // setup balls
    for (i = 1; i <= rows; i++) {
        x = cs * i + cs / 2;

        c = R.circle(x, 1/2 * cs + (model.redRow * cs), cr).attr("stroke-width", 3);
        c.attr("fill", "red");
        c.team = "red";
        c.name = "r" + i;
        c.node.onclick = makeClickListener(c);
        model.red.push(c);

        c = R.circle(x, 1/2 * cs + (model.whiteRow * cs), cr).attr("stroke-width", 3);
        c.attr("fill", "white");
        c.team = "white";
        c.name = "w" + i;
        c.node.onclick = makeClickListener(c);
        model.white.push(c);
    }
}

function parseCommand(commandStr) {
    var commandElements = commandStr.split(" ");
    var message = null;
    if (commandElements.length > 0 && commandElements[0].charAt(0) === '/') {
        var commandName = commandElements[0].slice(1);
        switch (commandName) {
        case CMD_NICK:
            if (commandElements[1] && commandElements[1].length > 0) {
                var nick = commandElements[1];
                message = { type : TYPE_COMMAND, name : CMD_NICK, arg : nick};
                model.nick(nick);
            }
            break;

        case CMD_INVITE:
            if (commandElements[1] && commandElements[1].length > 0) {
                message = { type : TYPE_COMMAND, name : CMD_INVITE, arg : commandElements[1] };
            }
            break;

        case CMD_ACCEPT:
            if (commandElements[1] && commandElements[1].length > 0) {
                message = { type : TYPE_COMMAND, name : CMD_ACCEPT, arg : commandElements[1] };
            }
            break;

        case CMD_DECLINE:
            if (commandElements[1] && commandElements[1].length > 0) {
                message = { type : TYPE_COMMAND, name : CMD_DECLINE, arg : commandElements[1] };
            }
            break;
        }
    }

    return message;
}

function initUI() {
    R = Raphael("holder", 500, 500);

    input = $("#in");
    output = $("#out");

    input.focus();

    input.keypress(
        function(event) {
            if (event.which == '13') {
                var dataStr = input.val();
                output.append("\nclient: " + dataStr);

                var message = parseCommand(dataStr);
                if (message != null && message != undefined) {
                    socket.send(message);
                    output.append("\nclient: Sent object " + JSON.stringify(message));
                } else {
                    output.append("\nclient: Syntax -- /&lt;command&gt; [arg1, arg2, ... ]");
                    output.append("\nclient: Commands available -- nick, invite, accept, decline");
                }

                input.val("");
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
    };

    handlers.disconnect = function() {
        model.status("disconnected");
        output.append('\nsystem: disconnected');
    };

    socket = CH_Socket(HOST, PORT, handlers);
    socket.connect();
}

$(function() {
   initUI();
   initSocket();
   ko.applyBindings(model);
   drawBoard();
   collisionResolver = CH_CollisionResolver(model.all(), cr);
});
