(function() {
     var global = this;

     var log = DS_utils.log;

     global.CH_Bot = function() {

         function makeTurn(piecesOnBoard, pieceMoved, velocityVector) {
             return { piece: "r1", vector: [1, 1] };
         }

         return {
             makeTurn: makeTurn
         };
     };
})();
