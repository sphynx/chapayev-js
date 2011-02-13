var http = require("http"),
    io = require("socket.io");

// data structures for storing players, games, game proposal, etc.
var players = {}, // map: client.sessionId -> player object
    nicks = {},   // map: player nickname  -> client.sessionId (opposite to players)
    invites = {}, // map: player id -> list of issued invitations by this player (other player ids)
    games = {};   // TODO

// setup socket and server
var server = http.createServer();
var socket = io.listen(server);

// util function for easy formatting
String.prototype.format = function() {
    var formatted = this;
    for (arg in arguments) {
        formatted = formatted.replace("{" + arg + "}", arguments[arg]);
    }
    return formatted;
};

function nickById(id) {
    return players[id] && players[id].nick;
}

function idByNick(nick) {
    return nicks[nick];
}

function pairPlayers(p1Id, p2Id, p1Nick, p2Nick) {
    console.log("pairing players {0} and {1}".format(p1Nick, p2Nick));
    var p1Msg =  { type: "gamestart", opponent: p2Nick, color: "red" };
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

    console.log("got cmd: " + cmdName);

    switch (cmdName) {
    case "nick":
        var newNick = message.arg;
        var oldNick = nickById(id);

        // update player's nick
        players[id].nick = newNick;

        // update nick-to-id map
        delete nicks[oldNick];
        nicks[newNick] = id;

        console.log("nick has been changed from {0} to {1} for player {2}".format(oldNick, newNick, id));
        socket.broadcast({ type: "nickchange", id: id, oldNick: oldNick, newNick: newNick });
        break;

    case "invite":
        // inviter -- a player issuing a game request (proposing to play)
        var inviterId = id;
        var inviterNick = nickById(id);

        // acceptor -- a player who may or may not accept the request (target of request)
        var acceptorNick = message.arg;
        var acceptorId = idByNick(acceptorNick);

        // check if inviter has been invited himself
        // if two players are inviting each other: pair them
        if (invites[acceptorId] && invites[acceptorId].indexOf(inviterId) !== -1) {
            console.log("Mutual invitation for players {0} and {1}".format(inviterNick, acceptorNick));
            pairPlayers(inviterId, acceptorId, inviterNick, acceptorNick);
        } else {
            // add the invite to invites map
            invites[inviterId]
                ? invites[inviterId].push(acceptorId) // add to an existing array
                : invites[inviterId] = [acceptorId];  // or create a new array with it

            // send an invitation to the acceptor
            socket.clients[acceptorId].send({ type: "gamerequest", from: inviterNick });
            console.log("player {0} has been invited to play with {1}".format(acceptorNick, inviterNick));
        }
        break;

    case "accept":
        acceptorId = id;
        acceptorNick = nickById(acceptorId);

        inviterNick = message.arg;
        inviterId = idByNick(inviterNick);

        if ((inviterId in invites) && invites[inviterId].indexOf(acceptorId) !== -1) {
            console.log("player {0} has accepted invitation from player {1}".format(acceptorNick, inviterNick));
            pairPlayers(inviterId, acceptorId, inviterNick, acceptorNick);
        } else {
            console.log("false accept from {0}".format(acceptorNick));
        }

        break;

    case "decline":
        var declinerId = id;
        var declinerNick = nickById(declinerId);

        inviterNick = message.arg;
        inviterId = idByNick(inviterNick);

        if ((invites[inviterId]) && invites[inviterId].indexOf(declinerId) !== -1) {
            console.log("player {0} has declined invitation from player {1}".format(declinerNick, inviterNick));
            var declineMsg = { type: "decline", from: declinerNick };
            // send "decline" msg to inviter
            socket.clients[inviterId].send(declineMsg);
            // remove decliner from invite list as the invite has been declined
            invites[inviterId].splice(invites[inviterId].indexOf(declinerId), 1);
        } else {
            console.log("false decline from {0}".format(declinerNick));
        }

        break;

    case "debug":
        console.log("debug info: ");
        console.log("players = " + JSON.stringify(players));
        console.log("nicks = " + JSON.stringify(nicks));
        console.log("invites = " + JSON.stringify(invites));
        break;

    case "list":
        var list = [];
        for (sessionId in players) {
            list.push(players[sessionId]);
        }
        client.send({ type: "playerslist", list: list });
        break;

    default:
        console.log("no such cmd defined yet: " + cmdName);
    };
}

// Add a connect listener
socket.on(
    "connection",
    function(client) {
        // Add the new user to the list of players
        var generatedNick = "anonymous" + Date.now();
        players[client.sessionId] = { nick: generatedNick};
        nicks[generatedNick] = client.sessionId;

        // Send to the new user the list of active players
        client.send({ type: "playerslist", list: players });

        // Broadcast the new user to all players
        socket.broadcast({ type: "new", id: client.sessionId }, [client.sessionId]);

        client.on(
            "message",
            function(message) {
                console.log("got message: " + JSON.stringify(message));

                switch (message.type) {
                    case "cmd":
                    cmdHandler(message, client);
                    break;

                    case "move":
                    client.broadcast(message, [client.sessionId]);
                    break;

                    default:
                    console.log("no handler specified yet for message.type = " + message.type);
                }
            });

        client.on(
            "disconnect",
            function () {
                // Remove the user from the list of players
                delete players[this.sessionId];

                // Broadcast the logged out user"s id
                socket.broadcast({ type: "left", id: this.sessionId });
            });
    });

// start listening
server.listen(8124);

