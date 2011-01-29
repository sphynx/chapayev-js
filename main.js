var cs = 50; // cell size
var boardTop = 0;
var boardLeft = 0;
var rows = 8; // number of rows and columns
var cr = cs/2 - 5; // radius of circle
var bs = rows * cs; // board size
var k = 1.5; // coefficient of "push-power"
var whiteRow = 8;
var redRow = 1;

var redScoreText;
var whiteScoreText;
var whiteScore = 8;
var redScore = 8;

var R;

// utility functions
var pow = Math.pow;
function sqr(x) {
    return pow(x, 2);
}

// given start position and velocity vector,
// calculates the position where ball will stop
function getStopPoint(p, vx, vy) {
    var dx = vx / cr * bs * k;
    var dy = vy / cr * bs * k;
    return p.add($V([dx, dy]));
}

// predict collision point for 2 balls (if exists).
// ball P moves from (p0x, p0y) to (pfx, pfy)
// ball Q stays at (q0x, q0y)
// returns vector of collision point or null if there is no collision

// implementaion is based on the article "Predictive Collision Detection":
// http://www.a-coding.com/2010/10/predictive-collision-detection.html
function predictCollisionPoint(p0, pf, q0) {
    var dp = pf.subtract(p0);

    // solve quadratic equation for vectors
    var a = sqr(dp.modulus());
    var b = 2 * dp.dot(p0.subtract(q0));
    var c = sqr(q0.subtract(p0).modulus()) - 4 * sqr(cr);
    var d = Math.sqrt(sqr(b) - 4 * a * c);

    // two collision times, use minimal as we are interested in first collision only
    var t1 = (-b + d) / (2 * a);
    var t2 = (-b - d) / (2 * a);
    var t = t1 < t2 ? t1 : t2;

    var collision = p0.add(dp.x(t));

    // 0.005 is used here to handle minor errors
    return (t >= -0.005 && t <= 1) ? collision : null;
}

// check all the balls to find whether they collide with given ball
// and find the nearest one.
// ball P moves from (p0x, p0y) to (pfx, pfy)
function getNearestCollisionPoint(p0, pf, balls) {
    var i, d, cp, other, q0, points = [];
    var result = null, dmin = 100000;

    for (i = 0; i < balls.length; i++) {
        other = balls[i];
        q0 = $V([other.attr("cx"), other.attr("cy")]);

        // skip the ball we are checking as we don't want it
        // to collide with itself
        if (!p0.eql(q0)) {
            cp = predictCollisionPoint(p0, pf, q0);
            if (cp) {
                points.push({point: cp, ball: other});
            }
        }
    }

    // detect nearest point, iterate over them and check
    for (i = 0; i < points.length; i++) {
        d = points[i].point.distanceFrom(p0);
        if (d < dmin) {
            dmin = d;
            result = points[i];
        }
    }

    return result;
}


function getRatio(p0, pc, pf) {
    var intendedDistance = pf.distanceFrom(p0);
    var collisionDistance = pc.distanceFrom(p0);
    return collisionDistance / intendedDistance;
}

// resolves collision between two balls: P and Q
//
// parameters:
// P started from `p0` with velocity `pv`, intended to go to `pf`,
// but collided at `pc`
//
// Q just stands at `q`
//
// returns new velocity vectors for both P and Q:
// {p: Pv, q: Qv}

// Implementation is based on article
// "Elastic Collisions Using Vectors instead of Trigonometry"
// http://www.vobarian.com/collisions/
function resolveCollision(p0, pc, pf, pv, q, ratio) {

    var x = pc;
    var y = q;

    // steps from the article
    // 1)
    var n = x.subtract(y);
    var un = n.toUnitVector();
    var ut = $V([-un.e(2), un.e(1)]);

    // 2)
    var v1 = pv;
    var v2 = Vector.Zero(2);

    // 3)
    var v1n = un.dot(v1);
    var v1t = ut.dot(v1);
    var v2n = un.dot(v2);
    var v2t = ut.dot(v2);

    // 4)
    var v1t_new_scalar = v1t;
    var v2t_new_scalar = v2t;

    // 5)
    var c = 1; // elastic case
    var v1n_new_scalar = (c * (v2n - v1n) + v1n + v2n) / 2;
    var v2n_new_scalar = (c * (v1n - v2n) + v1n + v2n) / 2;

    // 6)
    var v1n_new = un.x(v1n_new_scalar);
    var v1t_new = ut.x(v1t_new_scalar);
    var v2n_new = un.x(v2n_new_scalar);
    var v2t_new = ut.x(v2t_new_scalar);

    // 7)
    var v1_new = v1n_new.add(v1t_new);
    var v2_new = v2n_new.add(v2t_new);

    return {
        // p: pv.x(-0.1 * (1 - ratio)),
        // q: pv.x(0.25 * (1 - ratio))
        p: v1_new.x(1 - ratio),
        q: v2_new.x(1 - ratio)
        // p: v1_new,
        // q: v2_new
    };
}

function startBall(ball, balls) {

    var p0 = $V([ball.attr("cx"), ball.attr("cy")]);
    var pf = getStopPoint(p0, ball.vx, ball.vy);
    var pcb = getNearestCollisionPoint(p0, pf, balls);

    var easing = "linear";

    if (pcb) {
        var pc = pcb.point;
        var other = pcb.ball;
        var ratio = getRatio(p0, pc, pf);

        ball.animate({cx: pc.e(1), cy: pc.e(2)}, 1000 * ratio, easing,
                     makeCollisionCallback(p0, pc, pf, ball, other, balls, ratio));

    } else {
        ball.animate({cx: pf.e(1), cy: pf.e(2)}, 1000, easing,
                     function() {
                         if (this.attr("cx") < cs || this.attr("cx") > cs * (rows + 1)
                          || this.attr("cy") < cs || this.attr("cy") > cs * (rows + 1)) {
                             this.animate({"opacity": 0}, 400, "linear", function() { decreaseScore(this.team); this.remove(); });
                         }
                     });
    }
}

function makeCollisionCallback(p0, pc, pf, ball, other, balls, ratio) {

    return function() {
        var resolved = resolveCollision(p0, pc, pf,
                                        $V([ball.vx, ball.vy]),
                                        $V([other.attr("cx"), other.attr("cy")]),
                                        ratio);

        var pvx = resolved.p.e(1);
        var pvy = resolved.p.e(2);
        var qvx = resolved.q.e(1);
        var qvy = resolved.q.e(2);

        ball.vx = pvx;
        ball.vy = pvy;
        other.vx = qvx;
        other.vy = qvy;

        startBall(other, balls);
        startBall(ball, balls);
    };
};

function getBallSpeed(e, box) {
    var x, y, holder, f;

    // absolute location
    if (e.pageX !== undefined && e.pageY !== undefined) {
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

function makeClickListener(ball, balls) {
    return function(e) {
        // set ball velocity and start animation
        var v = getBallSpeed(e, ball.getBBox());
        ball.vx = v[0];
        ball.vy = v[1];

        startBall(ball, balls);
    };
}

function init() {
    Raphael.easing_formulas.test = function(n) {
         return n;
    };
}

function decreaseScore(team) {
    if (team === "white") {
        whiteScore--;
    } else {
        redScore--;
    }
    drawScore(whiteScore, redScore);
}

function drawScore(w, r) {
    var font = {font: '50px Helvetica, Arial', opacity: 0.5};
    whiteScoreText && whiteScoreText.remove();
    whiteScoreText = R.text(560, 400, w).attr(font).attr("fill", "white");
    redScoreText && redScoreText.remove();
    redScoreText = R.text(560, 110, r).attr(font).attr("fill", "red");
}

function drawBoard() {
    R = Raphael("holder", 640, 480);

    var i;
    var p = "";
    var balls = [];

    // 8x8 grid with path lines
    for (i = 1; i <= rows + 1; i++) {
        p += "M" + (boardLeft + cs * i + 0.5) + " " + (boardTop + cs) + "v" + bs;
        p += "M" + (boardLeft + cs) + " " + (boardTop + cs * i + 0.5) + "h" + bs;
    }
    p += "z";
    R.path(p).attr("stroke-width", 1);

    // setup balls
    for (i = 1; i <= rows; i++) {
        var x = boardLeft + cs * i + cs/2 + 0.5;

        var c1 = R.circle(x, boardTop + 1/2 * cs + (redRow * cs), cr).attr("stroke-width", 3);
        c1.attr("fill", "red");
        c1.team = "red";
        balls.push(c1);

        var c2 = R.circle(x, boardTop + 1/2 * cs + (whiteRow * cs), cr).attr("stroke-width", 3);
        c2.attr("fill", "white");
        c2.team = "white";
        balls.push(c2);

        // setup click listeners
        c1.node.onclick = makeClickListener(c1, balls);
        c2.node.onclick = makeClickListener(c2, balls);
    }

    drawScore(whiteScore, redScore, R);
}

$(function() {
   init();
   drawBoard();
});

