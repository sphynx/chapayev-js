var http = require("http"),
    journey = require("journey"),
    faye = require("faye"),
    util = require("./utils"),
    players = require("./players").Table(),
    games = require("./games").Games(),
    log = util.log;

// setup http-server to use Journey router
var server = http.createServer(
  function (request, response) {
    var body = "";
    request.addListener("data", function (chunk) { body += chunk; });
    request.addListener("end", function () {
        router.handle(request, body, function (result) {
            response.writeHead(result.status, result.headers);
            response.end(result.body);
        });
    });
});

// setup Faye-server
var bayeux = new faye.NodeAdapter({
       mount: "/faye",
       timeout: 45
    });
bayeux.attach(server);

// setup Faye-client attached to Faye-server
var client = bayeux.getClient();
client.subscribe("/commands", function(message) {
    log("got a message {0}", JSON.stringify(message));
});

// setup Journey
var router = new(journey.Router);
router.get('/init').bind(
    function(req, res, params) {
        // add the new user to the list of players
        var nick = players.add(1, params.nick);
        var callback = params.callback;

        log("new player: {0}", nick);

        // return approved nick
        res.sendJSONP(callback, { type: "nickack", nick: nick });

        // broadcast the new user to all players except the player himself
        client.publish("/new", { who: nick });
});

server.listen(8200);
