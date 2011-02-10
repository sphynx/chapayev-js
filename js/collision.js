// modularization is based on technique described in the following article:
// http://peter.michaux.ca/articles/how-i-write-javascript-widgets
(function() {
     // to make global functions more apparent
     var global = this;

     // helper functions which don't need access to state
     function sqr(x) {
         return Math.pow(x, 2);
     }

     // constructor, visible in global context
     //
     // circles: array of Raphael circle objects
     // radius: circle radius
     global.CH_CollisionResolver = function(circles, radius) {

         // private methods go first

         // predict collision point for 2 balls (if exists).
         // ball P moves from (p0x, p0y) to (pfx, pfy)
         // ball Q stays at (q0x, q0y)
         // returns vector of collision point or null if there is no collision.
         //
         // Implementaion is based on the article "Predictive Collision Detection":
         // http://www.a-coding.com/2010/10/predictive-collision-detection.html
         function predictCollisionPoint(p0, pf, q0) {
             var dp = pf.subtract(p0);

             // solve quadratic equation for vectors
             var a = sqr(dp.modulus());
             var b = 2 * dp.dot(p0.subtract(q0));
             var c = sqr(q0.subtract(p0).modulus()) - 4 * sqr(radius);
             var d = Math.sqrt(sqr(b) - 4 * a * c);

             // two collision times, use minimal as we are interested in first collision only
             var t1 = (-b + d) / (2 * a);
             var t2 = (-b - d) / (2 * a);
             var t = t1 < t2 ? t1 : t2;

             var collision = p0.add(dp.x(t));

             // 0.005 is used here to handle minor errors
             //return (t >= -0.005 && t <= 1) ? collision : null;
             return (t > 0 && t < 1) ? collision : null;
         }

         // check all the balls to find whether they collide with given ball
         // and find the nearest one.
         // ball P moves from (p0x, p0y) to (pfx, pfy)
         function getNearestCollisionPoint(p0, pf) {
             var i, d, cp, other, q0, points = [];
             var result = null, dmin = 100000;

             for (i = 0; i < circles.length; i++) {
                 other = circles[i];
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
         //
         // Implementation is based on article
         // "Elastic Collisions Using Vectors instead of Trigonometry"
         // http://www.vobarian.com/collisions/
         function resolveCollision(pc, pv, q) {

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
                 p: v1_new,
                 q: v2_new
             };
         };

         // public interface
         return {
             resolve: resolveCollision,
             predict: predictCollisionPoint,
             nearest: getNearestCollisionPoint
         };
     };
})();
