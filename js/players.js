exports.Table = function() {

    var players = {}; // map: client.sessionId -> player object
    var nicks = {};   // map: player nickname  -> client.sessionId (opposite to players)

    function add(id, nk) {
        if (id && nk) {
            if (players[id]) {
                return update(id, nk)[1];
            }
            nk = unique(nk);
            players[id] = { nick: nk };
            nicks[nk] = id;
            return nk;
        } else {
            return null;
        }
    }

    function remove(id) {
        var nk = nick(id);
        if (nk) {
            delete nicks[nk];
        }
        delete players[id];
    }

    function update(id, nk) {
        if (id && nk) {
            var oldNick = nick(id);
            delete nicks[oldNick];

            nk = unique(nk);
            nicks[nk] = id;

            if (players[id]) {
                players[id].nick = nk;
            } else {
                players[id] = { nick: nk };
            }

            return [oldNick, nk];
        } else {
            // ?
            return [null, null];
        }
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

    function get(clientId) {
        return (clientId) ? players[clientId] : players;
    }

    function nicksList() {
        var res = [];
        for (var nk in nicks) {
            res.push(nk);
        }
        return res;
    }

    function idList() {
        var res = [];
        for (var i in players) {
            res.push(i);
        }
        return res;
    }

    function size() {
        var res = 0;
        for (var i in nicks) {
            res++;
        }
        return res;
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
        nicks: nicksList,
        ids: idList,
        get: get,
        size: size
    };
};


