// Require HTTP module (to start server) and Socket.IO
var http = require('http'), io = require('socket.io');

// Start the server at port 8080
var server = http.createServer(function(req, res){ 

  // Send HTML headers and message
  res.writeHead(200,{ 'Content-Type': 'text/html' }); 
  res.end('<h1>Hello Socket Lover!</h1>');
});
server.listen(8124);

// Create a Socket.IO instance, passing it our server
var socket = io.listen(server);

// Add a connect listener
socket.on('connection', function(client){ 
  
  // Success!  Now listen to messages to be received
  client.on('message',function(event){ 
    console.log('Received message from client!',event);
  });

  client.on('disconnect',function(){
    clearInterval(interval);
    console.log('Client has disconnected');
  });

  // Create periodical which ends a message to the client every 5 seconds
  var interval = setInterval(function() {
    client.send('This is a message from the server!  ' + new Date().getTime());
		console.log('Sent a message to the client');
	  }, 
		5000);
	});
