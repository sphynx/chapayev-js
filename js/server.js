var http = require("http"),
    io = require("socket.io"),
    p = require("./players"),
    util = require("./server-utils");

// data structures for storing players, games, game proposal, etc.
var players = p.Table(),
    invites = {}, // map: player id -> list of issued invitations by this player (other player ids)
    games = {};   // TODO

// setup socket and server
var server = http.createServer();
var socket = io.listen(server);

var log = util.log;

function pairPlayers(p1Id, p2Id, p1Nick, p2Nick) {
    log("pairing players {0} and {1}", p1Nick, p2Nick);

    var p1Msg = { type: "gamestart", opponent: p2Nick, color: "red" };
    var p2Msg = { type: "gamestart", opponent: p1Nick, color: "white" };

    // two guys are paired, let's start the game!
    socket.clients[p1Id].send(p1Msg);
    socket.clients[p2Id].send(p2Msg);

    // empty list of invites for given players, since they already started a game
    // and all the other invites become invalid
    invites[p1Id] = [];
    invites[p2Id] = [];
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
        // inviter -- a player issuing a game request (proposing to play)
        var inviterId = id;
        var inviterNick = players.nick(id);

        // acceptor -- a player who may or may not accept the request (target of request)
        var acceptorNick = message.arg;
        var acceptorId = players.id(acceptorNick);

        // check if inviter has been invited himself
        // if two players are inviting each other: pair them
        if (invites[acceptorId] && invites[acceptorId].indexOf(inviterId) !== -1) {
            log("Mutual invitation for players {0} and {1}", inviterNick, acceptorNick);
            pairPlayers(inviterId, acceptorId, inviterNick, acceptorNick);
        } else {
            // add the invite to invites map
            invites[inviterId]
                ? invites[inviterId].push(acceptorId) // add to an existing array
                : invites[inviterId] = [acceptorId];  // or create a new array with it

            // send an invitation to the acceptor
            socket.clients[acceptorId].send({ type: "gamerequest", from: inviterNick });
            log("player {0} has been invited to play with {1}", acceptorNick, inviterNick);
        }
        break;

    case "accept":
        acceptorId = id;
        acceptorNick = players.nick(acceptorId);

        inviterNick = message.arg;
        inviterId = players.id(inviterNick);

        if ((inviterId in invites) && invites[inviterId].indexOf(acceptorId) !== -1) {
            log("player {0} has accepted invitation from player {1}", acceptorNick, inviterNick);
            pairPlayers(inviterId, acceptorId, inviterNick, acceptorNick);
        } else {
            log("false accept from {0}", acceptorNick);
        }

        break;

    case "decline":
        var declinerId = id;
        var declinerNick = players.nick(declinerId);

        inviterNick = message.arg;
        inviterId = players.id(inviterNick);

        if ((invites[inviterId]) && invites[inviterId].indexOf(declinerId) !== -1) {
            log("player {0} has declined invitation from player {1}", declinerNick, inviterNick);
            var declineMsg = { type: "decline", from: declinerNick };
            // send "decline" msg to inviter
            socket.clients[inviterId].send(declineMsg);
            // remove decliner from invite list as the invite has been declined
            invites[inviterId].splice(invites[inviterId].indexOf(declinerId), 1);
        } else {
            log("false decline from {0}", declinerNick);
        }

        break;

    case "debug":
        log("debug info: ");
        log("players = {0}", JSON.stringify(players));
        log("nicks = {0}", JSON.stringify(nicks));
        log("invites = {0}", JSON.stringify(invites));
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

                // Remove the user from the invites list
                delete invites[id];
            });
    });

// start listening
server.listen(8124);

