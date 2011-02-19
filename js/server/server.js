var http = require("http"),
    io = require("socket.io"),
    p = require("./players"),
    util = require("../utils.js");

var players = p.Table(),
    server = http.createServer(),
    socket = io.listen(server),
    log = util.log;

var PORT = 8124;

function pairPlayers(p1Id, p2Id, p1Nick, p2Nick) {
    log("pairing players {0} and {1}", p1Nick, p2Nick);
    socket.clients[p1Id].send({ type: "gamestart", opponent: p2Nick, color: "red" });
    socket.clients[p2Id].send({ type: "gamestart", opponent: p1Nick, color: "white" });
}

function cmdHandler(message, client) {
    var cmdName = message.name;
    var id = client.sessionId;

    log("received command {0}", cmdName);

    switch (cmdName) {
    case "nick":
        var nicks = players.update(id, message.arg);
        var oldNick = nicks[0];
        var newNick = nicks[1];

        log("nick has been changed from {0} to {1} for player {2}", oldNick, newNick, id);
        socket.broadcast({ type: "nickchange", oldNick: oldNick, newNick: newNick }, [id]);
        client.send({ type: "nickack", oldNick: oldNick, nick: newNick });
        break;

    case "invite":
        // host -- a player issuing a game request (proposing to play)
        // guest -- his opponent
        var hostId = id,
            hostNick = players.nick(id),
            guestNick = message.arg,
            guestId = players.id(guestNick);

        players.invite(hostId, guestId);

        // check for cross-invite
        if (players.isInvited(guestId, hostId)) {
            players.accept(hostId, guestId);
            pairPlayers(hostId, guestId, hostNick, guestNick);
            log("Mutual invitation for players {0} and {1}", hostNick, guestNick);
        } else {
            socket.clients[guestId].send({ type: "gamerequest", from: hostNick });
            log("player {0} has been invited to play with {1}", guestNick, hostNick);
        }
        break;

    case "accept":
        guestId = id,
        guestNick = players.nick(id),
        hostNick = message.arg,
        hostId = players.id(hostNick);

        if (players.accept(hostId, guestId)) {
            log("player {0} has accepted invitation from player {1}", guestNick, hostNick);
            pairPlayers(hostId, guestId, hostNick, guestNick);
        } else {
            log("false accept from {0}", guestNick);
        }

        break;

    case "decline":
        guestId = id,
        guestNick = players.nick(id),
        hostNick = message.arg,
        hostId = players.id(hostNick);

        if (players.decline(hostId, guestID)) {
            socket.clients[hostId].send({ type: "decline", from: guestNick });
            log("player {0} has declined invitation from player {1}", guestNick, hostNick);
        } else {
            log("false decline from {0}", guestNick);
        }

        break;

    case "list":
        var list = [];
        for (var sessionId in players.get()) {
            list.push(players[sessionId]);
        }
        client.send({ type: "playerslist", list: list });
        break;

    default:
        log("no such cmd defined yet: {0}", cmdName);
    };
}

socket.on(
    "connection",
    function(client) {
        log("new client connected");

        client.on(
            "message",
            function(message) {
                log("got message: {0}", JSON.stringify(message));
                var id = client.sessionId;

                switch (message.type) {
                case "cmd":
                    cmdHandler(message, client);
                    break;

                case "move":
                    // TODO: broadcast only to opponent!
                    client.broadcast(message, [id]);
                    break;

                case "chatmessage":
                    // stamp it with "from" field and broadcast to others
                    message.from = players.nick(id);
                    client.broadcast(message, [id]);
                    break;

                case "init":
                    // add the new user to the list of players
                    var nick = players.add(id, message.nick);

                    // send nick acknowledgement
                    client.send({ type: "nickack", nick: nick });

                    // send to the new user the list of active players (including himself)
                    client.send({ type: "playerslist", list: players.get() });

                    // broadcast the new user to all players except the player himself
                    socket.broadcast({ type: "new", id: id, who: nick }, [id]);
                    break;

                default:
                    log("no handler specified yet for message.type: {0}", message.type);
                }
            });

        client.on(
            "disconnect",
            function () {
                var id = this.sessionId;

                // Broadcast the logged out user's id
                socket.broadcast({ type: "left", id: id, who: players.nick(id) });

                players.remove(id);
            });
    });

// start listening
server.listen(PORT);
