var http = require("http"),
    journey = require("journey"),
    faye = require("faye"),
    util = require("../utils.js"),
    log = util.log;

// setup http-server to use Journey router
var server = http.createServer(
  function (request, response) {
    var body = "";
    request.addListener('data', function (chunk) { body += chunk; });
    request.addListener('end', function () {
        router.handle(request, body, function (result) {
            response.writeHead(result.status, result.headers);
            response.end(result.body);
        });
    });
});

// setup Faye
var bayeux = new faye.NodeAdapter({
       mount: "/faye",
       timeout: 45
    });
bayeux.attach(server);

// setup Journey
var router = new(journey.Router);
router.get('/init').bind(
    function(req, res, params) {
        var nick = params.nick;
        var callback = params.callback;
        res.sendJSONP(callback, { result: "approved", nick: nick });
});

// setup Faye-client attached to Faye-server
var client = bayeux.getClient();
client.subscribe("/commands", function(message) {
    log("got a message {0}", JSON.stringify(message));
});

server.listen(8200);
