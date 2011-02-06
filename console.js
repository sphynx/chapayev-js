var input;
var output;

var host = 'eth0.net.ua';
var port = 8124;

var socket;

function send(dataStr) {
    var data = JSON.parse(dataStr);
    socket.send(data);
}

function uiInit() {
    input = $("#in");
    output = $("#console");

    input.focus();

    input.keypress(
        function(event) { 
            if (event.which == '13') {
                var dataStr = "{" + input.val() + "}";
                send(dataStr);
                output.append("\nclient: " + dataStr);
                input.val("");
            }
        } 
    );
}

function socketInit() {
    socket = new io.Socket(host, { port: port });
    socket.connect();

    socket.on(
        'connect', 
        function() {
            output.append('\nsystem: connected');
        });

    socket.on(
        'message', 
        function(data) {
            output.append('\nserver: ' + JSON.stringify(data));
        });

    socket.on(
        'disconnect', 
        function() {
            output.append('\nsystem: disconnected');
        });
}

$(function() {
      uiInit();
      socketInit();
});
