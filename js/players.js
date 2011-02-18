(function() {
     var global = this;

     // constants go here

     // helper functions

     global.CH_PlayersTable = function() {

         var players = {}; // map: client.sessionId -> player object
         var nicks = {};   // map: player nickname  -> client.sessionId (opposite to players)

         function add(id, nk) {
             nk = unique(nk);
             players[id] = { nick: nk };
             nicks[nk] = id;
             return nk;
         }

         function remove(id) {
             var nk = nick(id);
             if (nk) {
                 delete nicks[nk];
             }
             delete players[id];
         }

         function update(id, nk) {
             var oldNick = unique(nick(id));
             oldNick && delete nicks[oldNick];
             if (players[id]) {
                 players[id].nick = nk;
             }
             nicks[nk] = id;
             return [oldNick, nk];
         }

         function reserved(nk) {
             return !!nicks[nk];
         }

         function nick(id) {
             return players[id] && players[id].nick;
         }

         function id(nick) {
             return nicks[nick];
         }

         function get() {
             return players;
         }

         function unique(nk) {
             return reserved(nk) ? nk + (Date.now() % 10000) : nk;
         }

         return {
             add: add,
             remove: remove,
             update: update,
             nick: nick,
             id: id,
             get: get
         };
     };
})();


