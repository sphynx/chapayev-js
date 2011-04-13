var Game = function(white, red) {

    var result = undefined;

    function setResult(res) {
        result = res;
    }

    return {
        white: white,
        red: red,
        result: result,
        setResult: setResult
    };
};

var gameId = 0;

exports.Games = function() {
    var games = [];  

    function start(white, red) {
        games.push(Game(white, red));
    }
    
    function finish(playerId) {
        var index = findByPlayer(playerId);
        if (index !== -1) {
            games.splice(index, 1);
        }
    }

    function opponentId(playerId) {
        var i, game;
        for (i = 0; i < games.length; i++) { 
            game = games[i];
            if (game.white === playerId) {
                return game.red;
            } else if (game.red === playerId) {
                return game.white;
            }
        }
        return null;
    }

    function find(white, red) {
        var i, game;
        for (i = 0; i < games.length; i++) { 
            game = games[i];
            if (game.white === white && game.red === red) {
                return i;
            } 
        }
        return -1;
    }

    function findByPlayer(playerId) {
        var i, game;

        for (i = 0; i < games.length; i++) { 
            game = games[i];
            if (game.white === playerId || game.red === playerId) {
                return i;
            } 
        }

        return -1;
    }

    return {
        start: start,
        finish: finish,
        opponentId: opponentId
    };
};
