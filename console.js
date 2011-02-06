var input;
var output;

var HOST = 'eth0.net.ua';
var PORT = 8124;

var TYPE_COMMAND = "cmd";
var CMD_NICK = "nick";

var socket;

function send(dataStr) {
    var message = parseCommand(dataStr);
    if (message != null && message != undefined) {
        socket.send(message);
        output.append("\nclient: Sent object " + JSON.stringify(message));
    } else {
        // TODO: show help
    }
}

function parseCommand(commandStr) {
    var commandElements = commandStr.split(" ");
    var message = null;
    if (commandElements.length > 0 && commandElements[0].charAt(0) === '/') {
        var commandName = commandElements[0].slice(1);
        switch (commandName) {
        case "nick":
            if (commandElements[1] && commandElements[1].length > 0) {
                message = { type : TYPE_COMMAND, name : CMD_NICK, arg : commandElements[1] };
            }
            break;
        }
    }

    return message;
}

function uiInit() {
    input = $("#in");
    output = $("#console");

    input.focus();

    input.keypress(
        function(event) { 
            if (event.which == '13') {
                var dataStr = input.val();
                output.append("\nclient: " + dataStr);
                send(dataStr);
                input.val("");
            }
        } 
    );
}

function socketInit() {
    socket = new io.Socket(HOST, { port: PORT });
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
