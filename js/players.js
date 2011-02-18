(function() {
     var global = this;

     // constants go here

     // helper functions

     global.CH_PlayersTable = function() {

         var players = {}; // map: client.sessionId -> player object
         var nicks = {};   // map: player nickname  -> client.sessionId (opposite to players)

         function add(id, nick) {
             players[id] = { nick: nick };
             nicks[nick] = id;
         }

         function remove(id, nick) {
             var nk = nick(id);
             nk && delete nicks[nk];
             delete players[id];
         }

         function update(id, nick) {
             var oldNick = nick(id);
             oldNick && delete nicks[oldNick];
             players[id] && players[id].nick = nick;
             nicks[nick] = id;
             return oldNick;
         }

         function reserved(nick) {
             return !!nicks[nick];
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


