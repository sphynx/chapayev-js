var http = require('http'),
    io = require('socket.io'),
    players = {};

// setup socket and server
var server = http.createServer();
var socket = io.listen(server);

function cmdHandler(message, client) {
    var cmdName = message.name;
    console.log('got cmd: ' + cmdName);
    switch (cmdName) {
        case 'nick':
        players[client.sessionId].nick = message.arg;
        console.log('nick has been changed to ' + message.arg + ' for player ' + client.sessionId);
        break;

        default:
        console.log('no such cmd defined yet: ' + cmdName);
    };
}

// Add a connect listener
socket.on(
    'connection',
    function(client) {
        // Send to the new user the list of active players
        client.send({ type: 'playerslist', list: players });

        // Add the new user to the list of players
        players[client.sessionId] = { nick: 'anonymous' };

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
                socket.broadcast({ type: 'leave', id: this.sessionId });
            });
    });

// start listening
server.listen(8124);

