(function() {
     var global = this;

     var log = DS_utils.log;

     global.CH_Socket = function(host, port, handlers) {

         // internal socket used for connection
         var socket;

         // default simple handlers if no handlers has been passed as a parameter
         function defaultConnectHandler() {
             log("connected");
         }

         function defaultMessageHandler(msg) {
             log("got message: " + JSON.stringify(msg));
         }

         function defaultDisconnectHandler() {
             log("disconnected");
         }

         // main connect function
         function connect() {
             // using socket.io sockets as implementation
             socket = new io.Socket(host, { port: port });
             socket.connect();

             socket.on(
                 "connect",
                 (handlers && handlers["connect"]) || defaultConnectHandler);

             socket.on(
                 "message",
                 (handlers && handlers["message"]) || defaultMessageHandler);

             socket.on(
                 "disconnect",
                 (handlers && handlers["disconnect"]) || defaultDisconnectHandler);
         }

         function send(msg) {
             socket.send(msg);
         }

         return {
             host: function() { return host; },
             port: function() { return port; },
             connect: function() { connect(host, port); },
             send: function(msg) { send(msg); }
         };
     };
})();
