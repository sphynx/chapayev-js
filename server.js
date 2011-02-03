var http = require('http'), 
    io = require('socket.io'),
    players = {};

// setup socket and server
var server = http.createServer();
var socket = io.listen(server);

// Add a connect listener
socket.on('connection', function(client) { 

              // Send to the new user the list of active players
              client.send({ type: 'playerslist', list: players });

              // Add the new user to the list of players
              players[client.sessionId] = { name: 'newbie' };

              // Broadcast the new user to all players
              socket.broadcast({ type: 'new', id: client.sessionId }, [client.sessionId]);

              client.on('message', function (message) {
                            if (message.type != 'name') {
                                return;
                            }
                            console.log('setting name of ' + message.id + ' to ' + message.name);
                            players[message.id] = { name: message.name };
                            client.broadcast(message, [message.id]);
                        });

              client.on('disconnect', function () {
                            // Remove the user from the list of players
                            delete players[this.sessionId];

                            // Broadcast the logged out user's id
                            socket.broadcast({ type: 'leave', id: this.sessionId });
                        });
	      });

// start listening
server.listen(8124);
