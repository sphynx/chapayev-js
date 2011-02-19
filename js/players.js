Array.prototype.contains = function(el) {
    return this.indexOf(el) !== -1;
};

var Player = function(id, nick) {
    return {
        id: id,
        nick: nick
    };
};

exports.Table = function() {

    var players = {}; // map: client.sessionId -> player object
    var nicks = {};   // map: player nickname  -> client.sessionId (opposite to players)
    var invites = {}; // map: player id -> list of issued invitations by this player (other player ids)

    function add(id, nk) {
        if (id && nk) {
            if (players[id]) {
                return update(id, nk)[1];
            }
            nk = unique(nk);
            players[id] = Player(id, nk);
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
                players[id] = Player(id, nk);
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
        return clientId ? players[clientId] : players;
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

    function invite(host, guest) {
        if (host && guest
            && players[host] && players[guest]
            && host !== guest) {

            if (invites[host]) {
                if (!invites[host].contains(guest)) {
                    invites[host].push(guest);
                }
            } else {
                invites[host] = [guest];
            }
            // correct invite
            return true;
        }
        return false;
    };

    function isInvited(host, guest) {
        return host && guest && invites[host] && invites[host].contains(guest);
    }

    function decline(host, guest) {
        if (host && guest) {
            var guestlist = invites[host];
            if (guestlist && guestlist.contains(guest)) {
                var index = guestlist.indexOf(guest);
                guestlist.splice(index, 1);
                // correct accept
                return true;
            }
        }
        return false;
    }

    function accept(host, guest) {
        if (host && guest) {
            var guestlist = invites[host];
            if (guestlist && guestlist.contains(guest)) {
                var index = guestlist.indexOf(guest);
                guestlist.splice(index, 1);
                clearInvites(host, guest);
                invites[host] = [];
                invites[guest] = [];
                // correct accept
                return true;
            }
        }
        return false;
    }

    function clearInvites() {
        for (var i = 0; i < arguments.length; i++) {
            if (invites[arguments[i]]) {
                invites[arguments[i]] = [];
            }
        }
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
        size: size,
        invite: invite,
        isInvited: isInvited,
        accept: accept,
        decline: decline
    };
};
