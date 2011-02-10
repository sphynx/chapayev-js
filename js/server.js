var http = require('http'),
    io = require('socket.io');

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

function cmdHandler(message, client) {
    var cmdName = message.name;
    var id = client.sessionId;

    console.log('got cmd: ' + cmdName);

    switch (cmdName) {
    case 'nick':
        var newNick = message.arg;
        var oldNick = nickById(id);

        // update player's nick
        players[id].nick = newNick;

        // update nick-to-id map
        delete nicks[oldNick];
        nicks[newNick] = id;

        console.log('nick has been changed from {0} to {1} for player {2}'.format(oldNick, newNick, id));
        socket.broadcast({ type: 'nickchange', id: id, oldNick: oldNick, newNick: newNick });
        break;

    case 'invite':
        // inviter -- a player issuing a game request (proposing to play)
        var inviterId = id;
        var inviterNick = nickById(id);

        // acceptor -- a player who may or may not accept the request (target of request)
        var acceptorNick = message.arg;
        var acceptorId = idByNick(acceptorNick);

        // add the invite to invites map
        invites[inviterId] = [acceptorId];

        // send an invitation to the acceptor
        socket.clients[acceptorId].send({ type: "gamerequest", from: inviterNick });
        console.log('player {0} has been invited to play with {1}'.format(acceptorNick, inviterNick));
        break;

    case 'accept':
        acceptorId = id;
        acceptorNick = nickById(acceptorId);

        inviterNick = message.arg;
        inviterId = idByNick(inviterNick);

        if ((inviterId in invites) && invites[inviterId].indexOf(acceptorId) !== -1) {
            console.log('player {0} has accepted invitation from player {1}'.format(acceptorNick, inviterNick));
            var gameStartAcceptorMsg = { type: "gamestart", opponent: inviterNick, color: "red" };
            var gameStartInviterMsg =  { type: "gamestart", opponent: acceptorNick, color: "white" };
            // two guys are paired, let's start the game!
            // send to acceptor
            client.send(gameStartAcceptorMsg);
            // send to inviter
            socket.clients[inviterId].send(gameStartInviterMsg);
        } else {
            console.log('false accept from '.format(acceptorNick));
        }

        break;

    default:
        console.log('no such cmd defined yet: ' + cmdName);
    };
}

// Add a connect listener
socket.on(
    'connection',
    function(client) {
        // Add the new user to the list of players
        var generatedNick = 'anonymous' + Date.now();
        players[client.sessionId] = { nick: generatedNick};
        nicks[generatedNick] = client.sessionId;

        // Send to the new user the list of active players
        client.send({ type: 'playerslist', list: players });

        // Broadcast the new user to all players
        socket.broadcast({ type: 'new', id: client.sessionId }, [client.sessionId]);

        client.on(
            'message',
            function(message) {
                console.log('got message: ' + JSON.stringify(message));

                switch (message.type) {
                    case "cmd":
                    cmdHandler(message, client);
                    break;

                    case "move":
                    client.broadcast(message, [client.sessionId]);
                    break;

                    default:
                    console.log('no handler specified yet for message.type = ' + message.type);
                }
            });

        client.on(
            'disconnect',
            function () {
                // Remove the user from the list of players
                delete players[this.sessionId];

                // Broadcast the logged out user's id
                socket.broadcast({ type: 'left', id: this.sessionId });
            });
    });

// start listening
server.listen(8124);

